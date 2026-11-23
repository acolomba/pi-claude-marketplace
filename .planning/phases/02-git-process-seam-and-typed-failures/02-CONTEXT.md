# Phase 2: Git Process Seam and Typed Failures - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Every git process the extension starts, and the SSH probe, starts from one
platform module (`platform/git-process.ts`, extracted from the launcher in
`platform/package-manager.ts`). That module cannot prompt, hang, run code from a
cloned repository, reach the network on a local lane, or act on the user's own
project repository. A git failure reaches its caller as a typed error with a
`kind`, read from git's exit status and its stderr under `LC_MESSAGES=C`. A user
with no usable git gets a clear message, and path-source and hosted-manifest
marketplaces keep working without git.

The product still clones with `isomorphic-git` after this phase: the module
lands with its first real consumer (for example `listRemotes` or
`currentBranch`, or the `git credential` launch of `platform/git-credential.ts`),
so `fallow dead-code` stays green with no `ignoreExports` entry. The transport
swap is Phase 3. Error wording waits for Phase 6. The requirements are
SG-PRC-01 through SG-PRC-06.

</domain>

<decisions>
## Implementation Decisions

The full upstream evidence records (Claude Code 2.1.330 binary, grepped
2026-11-23, never run; git 2.43.0 experiments) are in `02-EVIDENCE.md` in this
directory. Each decision below cites its record. Each lands in PROJECT.md Key
Decisions under its `D-SG-NN` ID.

### Transport and constraint amendments (asked; maintainer accepted the recommendation 2026-11-23)
- D-SG-01 (Q1, reverses D-21): system `git` only, with no `isomorphic-git` fallback, as Claude Code has no fallback and no in-process git. A user with no usable git gets an error naming the requirement; on macOS the upstream form "git is not installed on this Mac. To install it, run xcode-select --install, then try again." (exact text per `02-EVIDENCE.md` Q1). Path-source and hosted-manifest marketplaces still add and install without git (SG-PRC-06). SG-CLS-01 stays in scope (Phase 8 removes the dependency). — **Reversibility:** costly — once Phase 3 deletes the isomorphic-git transport, a fallback means re-adding a second transport, classifier set, and test matrix.
- D-SG-02 (Q11, amends SG-PRC-04 and NFR-5): local-only git commands (those NFR-5 requires to be network-free) run on upstream's own network-free lane (`ms()`): `GIT_ALLOW_PROTOCOL=/`, `GIT_SSH_COMMAND=false`, neutralized remote helpers, `GIT_NO_LAZY_FETCH=1`, `GIT_LFS_SKIP_SMUDGE=1`. SG-PRC-04's text changes from `protocol.allow=never` to this lane, because a user's `protocol.<name>.allow=always` in `~/.gitconfig` beats `-c protocol.allow=never` (experiment in `02-EVIDENCE.md` Q11). NFR-5 names the SSH probe as a network operation that runs only on paths that already allow the network. ESLint BLOCK F `NETWORK_SEAMS` gets no new entry: the module sits in `platform/` behind `GitOps`. — **Reversibility:** costly — the lane is a recorded constraint amendment that later phases' local verbs (Phase 3's refresh, checkout, ref reads) build on.
- D-SG-03 (Q12, amends NFR-10): files that git and ssh write through the user's own configuration (a credential helper's `store`/keychain write such as `~/.git-credentials`, ssh's `known_hosts`) are outside NFR-10's containment scope, as upstream prevents none of them; the extension itself still writes nothing outside its roots. Precedent: D-BG-1102 already writes `.git-credentials` through the user's helper. No `-o UpdateHostKeys=no` is added. — **Reversibility:** costly — it is a recorded amendment of a project constraint (NFR-10) that Phase 8 restates.

### Decided autonomously
- [Git detection] Q: "How does the extension detect a missing or unusable git (Q3)?" → Selected: "D-SG-04: Claude Code's method. One lookup per process, cached only when git is found (a cached 'missing' would need a Pi restart, which NFR-2 forbids — this licenses dropping upstream's 'restart Claude Code' hint). On macOS, check for the xcrun shim before a git spawn and classify an `xcrun: error:` stderr as git missing. On Windows, look only in absolute PATH entries, refuse a match inside the cwd (upstream rule, new to Pi), and refuse `.cmd`/`.bat` launchers (D-PL9-18 no-shell gap). Reuse the D-PL9-18 lookup extracted from `platform/package-manager.ts`. Classify-after-spawn (ENOENT, exit 127) is the backstop." — internal module behavior; detection order and caching are local to one function.
- [Hardening] Q: "Which in-checkout hardening does every git command carry (Q14 part)?" → Selected: "D-SG-05: one builder applies upstream's combined set to every git command: the generic `uxt` `-c` list (hooks off including the 28 `hook.*.enabled=false` keys, `core.hooksPath`, `core.fsmonitor=false`, `log.showSignature=false`, `format.pretty=medium`, `diff.autoRefreshIndex=false`, `core.alternateRefsCommand`, protocol bans for ext/fd/git/ftp/ftps, `init.defaultRefFormat=files`, `core.longpaths=true`), the environment builder (`GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=` empty, `GCM_INTERACTIVE=never`, `credential.interactive=false`, repo-pointer variables stripped, `GIT_CEILING_DIRECTORIES`, `GIT_NO_REPLACE_OBJECTS`, `GIT_PROXY_COMMAND=` empty, `GIT_LFS_SKIP_SMUDGE=1`, `GIT_DEFAULT_REF_FORMAT=files`), ssh BatchMode and StrictHostKeyChecking appended to the user's own ssh command (never replacing it), plus `LC_MESSAGES=C` on every command and `init.templateDir=` (empty). Exact lists per `02-EVIDENCE.md` Q14. User settings upstream does not neutralize (autocrlf, symlinks) are left alone in this phase (Phase 3 decides old-clone settings)." — adding keys is local to one builder; no user-visible difference.
- [Version floor] Q: "Does the extension enforce a git version floor (Q17)?" → Selected: "D-SG-06: as Claude Code, no version probe and no refusal. Document git 2.25 or later (README, Phase 8). Add a classifier row so an 'unknown option' failure or exit 129 maps to a 'git too old' kind, and log the git version in the debug output. No CI floor-version leg." — documentation plus one classifier row.
- [Typed errors] Q: "What shape do typed git failures take (SG-PRC-05)?" → Selected: "One `GitCommandError` class (in `shared/errors.ts` per CONVENTIONS) with a readonly `kind` from a closed union, narrowed by `instanceof` and `kind`, never by name or message substring. The kind set covers upstream's classes (timeout with its limit, host key changed, host key unknown, SSH auth, HTTPS auth, network, git missing, proxy refused, remote error, no stderr with exit code, pin mismatch, refused input) plus Pi's (remote ref missing, local ref missing, commit missing, repository not found, protocol refused, dubious ownership, aborted, git too old). The trigger-to-kind table is in `02-EVIDENCE.md`. Stderr is redacted before it is stored on the error. The isomorphic-git name matchers stay until Phase 3 swaps the transport." — an internal error type; Phase 6 maps kinds to wording.
- [Seam and gates] Q: "How do the gates change with the module?" → Selected: "`child-process-chokepoint` names `platform/git-process.ts` (git and ssh launches) and drops `platform/git-credential.ts` once its `git credential` spawn moves into the module; `test/architecture/no-shell-out.test.ts` and `test/architecture/gate-targets.ts` change in the same commit. An ESLint BLOCK C zone lets only `platform/git.ts` and `platform/git-credential.ts` import the new module. Async `spawn` only (no `execFile` 1 MiB cap, no sync calls), argument arrays, no shell, closed stdin, `--end-of-options` before marketplace-controlled data, a timeout that kills the whole process group (shared with the D-PL9-15/19 launcher)." — gate edits are local and change together.
- [Test hermeticity carried from Phase 1] Q: "How does a unit test give production git spawns a hermetic environment (Phase 1 deferred item)?" → Selected: "The module takes its base environment as an injected parameter that defaults to `process.env` (the CONVENTIONS dependency-injection rule); unit tests pass `hermeticGitEnvironment`-built bases. No test preload." — a parameter with a default.

### Claude's Discretion
- File split inside `platform/` (one module or a module plus an error-classifier module), as long as the chokepoint names every launching file.
- Which first consumer lands with the module (`listRemotes`, `currentBranch`, or the `git credential` launch).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/package-manager.ts`: the D-PL9-15/18/19 launcher (process-group kill, absolute-PATH `.exe`/`.cmd` resolution, no shell) to extract so `fallow dupes` stays clean.
- `platform/git-credential.ts`: already spawns `git credential` with `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` (lines ~148-160).
- `features/lib/hermetic-git.ts`, `features/lib/ssh-git-host/*`, `features/lib/https-git-host/*`: Phase 1 stand-ins for cucumber scenarios (git missing, auth, host key, timeout arms).

### Established Patterns
- Typed errors: `extends Error`, `this.name` set, readonly structured fields, `{ cause }` passthrough, narrowing by `instanceof` (CONVENTIONS).
- Gates that change with code: `rule-packs/architecture.json`, `test/architecture/gate-targets.ts`, `no-shell-out.test.ts`, ESLint BLOCK C/F (milestone rule "Green gate").

### Integration Points
- `orchestrators/` name-matchers of `NotFoundError`, `CommitNotFetchedError` (three sites plus one test fake) and the classifier's `code` matchers stay until Phase 3.
- SG-PRC-06 cucumber scenarios: `marketplace add` and plugin install with no git on PATH; path-source and hosted marketplaces still work.

</code_context>

<specifics>
## Specific Ideas

Evidence-record summary (full records in `02-EVIDENCE.md`):

- Q1 — Claude Code 2.1.330: no fallback, 0 isomorphic-git hits; messages "Git is required to install marketplaces." / "Install git and restart Claude Code." (`/plugin` UI), the git-subdir "requires git to be installed and on PATH ... (version 2.25 or later ...)", the macOS xcode-select message. HIGH (Linux `marketplace add` no-git text MEDIUM).
- Q3 — `Bun.which("git")` cached; macOS xcrun-shim check (exit 127) and `xcrun: error:` classification; Windows absolute PATH only, PATHEXT limited, cwd matches refused, Git-for-Windows launcher bypass at ≥ 2.26. HIGH for code and messages, MEDIUM for branch triggers (Linux build compiles the Windows/macOS checks to false).
- Q11 — upstream has no `protocol.allow=never`; its network-free lane `ms()` uses `GIT_ALLOW_PROTOCOL=/`; plugin/marketplace local commands are not laned upstream. User config beats `-c protocol.allow=never` (verified on git 2.43). HIGH.
- Q12 — upstream leaves credential helpers on; `StrictHostKeyChecking=yes`; no `UpdateHostKeys` in the binary. HIGH (OpenSSH UpdateHostKeys default MEDIUM).
- Q14 — three layers (generic `uxt` list on every process, env builder, `pinArgs`/`inCheckoutArgs`); `LC_MESSAGES=C` only on plugin and git-subdir clones upstream (Pi applies it everywhere, no user-visible difference). `GIT_ASKPASS=""` blocks `core.askPass` and `SSH_ASKPASS`. HIGH.
- Q17 — no probe on plugin/marketplace paths; `--end-of-options` (2.24) is the only hard floor; other keys are ignored by older git; a fetch exiting 129 is retried with `--dry-run` upstream. HIGH / MEDIUM on version numbers.

Corrections to the milestone research (carry to Phase 3+): `NETWORK_SEAMS` has 18 entries, not 17; upstream's Windows "not found or is in an unsafe location" message is the generic safe-spawn text, not git-specific.

The roadmap plans one manual check by hand on macOS and on Windows for this phase.

</specifics>

<deferred>
## Deferred Ideas

- Error wording for each kind: Phase 6.
- Old-clone settings (autocrlf, symlinks, filemode): Phase 3 (Q5, Q14 part).
- `-o UpdateHostKeys=no`: declined (D-SG-03).
- A CI floor-version leg: declined (D-SG-06); revisit if the README promises a floor that CI should prove.

</deferred>
