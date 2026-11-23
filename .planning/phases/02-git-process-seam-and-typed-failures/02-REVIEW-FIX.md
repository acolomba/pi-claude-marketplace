---
phase: 02-git-process-seam-and-typed-failures
fixed_at: 2026-11-23T20:15:00Z
review_path: .planning/phases/02-git-process-seam-and-typed-failures/02-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
out_of_scope_skipped: 2
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-23T20:15:00Z
**Source review:** .planning/phases/02-git-process-seam-and-typed-failures/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (CR-01, CR-02, WR-01 to WR-06, IN-02)
- Fixed: 9
- Skipped in scope: 0
- Out of scope, left as they are: 2 (IN-01, IN-03)

**Where verification ran:** every gate ran in the main checkout on `features/system-git`. No worktree was used. Each fix commit went through the pre-commit hook, which ran `npm run check:commit` (static checks, the unpaired unit tests, and direct coverage of the staged pairs). Before each commit, the pair's unit tests, `npm run typecheck`, ESLint with `--max-warnings 0` on the touched files, `npm run fallow`, and `npm run test:coverage:direct -- <source>` for every touched pair also passed. Unit runs used a hermetic environment (`env -i`, a short `TMPDIR`, `scripts/isolated-pi-home.mjs`). After the last fix, these also passed: the `adapter` cucumber profile on `features/marketplace/{git-source,without-git,github-source,info,device-flow}.feature`, `features/plugin/{git-source,git-source-update,without-git}.feature`, and `features/hook/stop-failure.feature` (180 scenario runs in two batches, all passing), plus `test/integration/auth-e2e.test.ts`, `test/integration/project-install-adds-user-marketplace.test.ts`, and `test/platform/git.test.ts`. `npm run check` on the combined tree was not run here; it stays with the phase gate.

**User-visible behavior:** none of the fixes changes what `/claude:plugin` shows or does, so no cucumber scenario was added. In production, system git still runs only `git credential` and the git lookup. Clone and fetch still run through isomorphic-git until the transport swap. The one new effect on disk is the directory `<agentDir>/pi-claude-marketplace/git-neutral`, which is created the first time a git command runs.

## Fixed Issues

### CR-01: The neutral directory is the shared temp directory, so a repository planted at its root steers credential and ssh lookups

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/platform/git-neutral-directory.ts` (new), `test/platform/git-neutral-directory.test.ts` (new), `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/git-process.test.ts`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/PROJECT.md`
**Commits:** 36101c2 (fix), 8973f1a (D-SG-05 outcome text in PROJECT.md)
**Applied fix:**

- The neutral directory is now `<agentDir>/pi-claude-marketplace/git-neutral`. It sits inside the user scope's extension root, as NFR-10 requires. `platform/` may reach `getAgentDir()` through `platform/pi-api.ts`, as `workflow-home.ts` already does, so the mkdtemp fallback was not needed.
- The new module `createNeutralDirectory({ parent, uid })` runs one mkdir of mode 0700, which is atomic, on first use. Before every use it checks that the path is a real directory, not a symbolic link, and that it is empty. On POSIX it also checks that the current user owns it and that no group or other bit is set. On Windows (no `process.getuid`) only the directory, symlink, and empty checks run. A failed check is refused and never repaired.
- `GitProcessHost.tmpdir` is replaced by `neutralDirectory(): Promise<string>`. When that rejects, the command fails before any launch with a `failed` GitCommandError whose cause is the rejection. `NODE_GIT_HOST` binds the directory to `getAgentDir()`. `GIT_CEILING_DIRECTORIES` is still the parent, which is now the extension root, so git looks only in the private directory.
- `safe.bareRepository=explicit` moved from the local-lane pairs to `PIN_PAIRS`, so both lanes carry it.
- ARCHITECTURE.md (the Authentication line and the platform list), STRUCTURE.md, and the D-SG-05 outcome in PROJECT.md now describe the new directory.
- To satisfy fallow without a new `fallow-ignore` marker, `createNeutralDirectory` is the only export of the new module. Its host type is written inline, and git-process.ts composes the production binding.

**How verified:**

- Real-git cases (git 2.43, hermetic base environment) plant a repository, and in a second case a bare layout, in the parent of the neutral directory. That repository sets a recording `credential.helper` and a recording `core.sshCommand`. A positive control shows that plain git in that directory reads the planted value. Through the module, `credential fill` rejects as `https-auth`, and an ssh `ls-remote` runs the user's own recording `ssh`. Neither planted script runs.
- A second real-git case shows that a bare layout at a network-lane working directory is not taken for a repository.
- Mutation checks: with the neutral directory pointed at the shared parent (the old behavior), the planted-repository case fails. Without `safe.bareRepository=explicit`, the bare-cwd case fails.
- The cases pass both as root (this sandbox) and as non-root: the owner check compares against `process.getuid()`, and the other-owner case injects `uid + 1`.
- Unit cases cover each check: a symlink, a file, a non-empty directory, modes 0750, 0705, and 0755, another owner, no uid, a parent that cannot be made, and a parent that is a symlink.

### CR-02: The ssh wrapper hides the variant from git, so plink and TortoisePlink run as `simple`

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/git-process.test.ts`, `.planning/PROJECT.md`
**Commit:** d950623
**Applied fix:**

- When the user set no `GIT_SSH_VARIANT`, `exportedVariant()` now exports `GIT_SSH_VARIANT`. Its value is the user's `ssh.variant` if one is set (as before). Otherwise it is the lowercased, `.exe`-stripped base name of the command's first word, when that name is `ssh`, `plink`, `putty`, or `tortoiseplink`.
- Any other base name exports nothing, so git keeps its own `-G` check, as it would without the wrapper. A user `GIT_SSH_VARIANT` still reaches git unchanged.
- The D-SG-08 row was added to PROJECT.md Key Decisions right after D-SG-07. It records the reason, the divergence from Claude Code 2.1.330, and that the change is cheap to reverse.

**How verified:**

- The composition table rows now expect the exported variant, including new rows for `ssh.exe` and `putty`. The stand-in cases no longer see a `-G` launch.
- New real-git cases list `ssh://git@stand-in.test:2222/acme/tools.git` through a `plink` stand-in and a `tortoiseplink` stand-in. Each stand-in refuses `-G` and hands the OpenSSH form to the stub ssh. Each lists the refs and records `-batch -P 2222 git@stand-in.test git-upload-pack '/acme/tools.git'`.
- With the export removed, both cases fail with `fatal: ssh variant 'simple' does not support setting port`, the review's reproduction.

### WR-01: Remote-controlled stderr lines can choose the failure kind

**Status:** fixed: requires human verification (classifier logic; the corpus discriminates, but review the anchors against stderr forms the corpus does not hold)
**Files modified:** `extensions/pi-claude-marketplace/platform/git-failure-kind.ts`, `test/platform/git-failure-kind.test.ts`
**Commit:** 225e669
**Applied fix:**

- Rows now test git's own lines: the stderr with `^remote: ` lines removed. Each row is anchored where git or ssh starts the line (`^fatal:`, `^error:`, `^ssh:`, `^@ +WARNING:`, `^Host key verification failed\.`, `^\S+: Permission denied (publickey`, and so on).
- The network texts are anchored inside git's `fatal:` and `error:` lines.
- Only the proxy row (`{ wholeStderr: /^remote: access denied by the git proxy/m }`) and the no-stderr row read the whole stderr.
- The xcrun row requires every line to be an `xcrun: error:` line. So neither a `remote:` line nor an ssh server's raw stderr can mark a working git as missing, or clear the found-git cache.
- `networkFailure` reads the HTTP status and the curl code from git's own lines.

**How verified:**

- Every existing corpus row passes, in both LF and CRLF forms.
- 14 new rows put each spoofable phrase in a `remote:` line before a generic `fatal: the remote end hung up unexpectedly`: xcrun, host key changed or unknown, publickey, prompts disabled, dubious ownership, transport not allowed, unknown option, unresolved ssh and HTTP host, repository not found, missing remote ref, remote error, and the read-failed block. All of these classify as `failed`.
- Four more new rows: an ssh server's raw `xcrun:` line before git's block classifies as `ssh-auth`. A remote curl line before a 403 gives `https-auth`. A remote 401 before a 503 gives `network` with `httpStatus: 503`. Remote lines alone give `failed`.
- Against the old module, 26 rows fail. With only the `remote:` strip removed, 2 rows fail, so both layers are pinned.

### WR-02: The network lane's translation of `GIT_ALLOW_PROTOCOL` drops the user's ban on every transport outside the four names

**Status:** fixed: requires human verification (protocol policy; checked against git 2.43)
**Files modified:** `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/git-process.test.ts`
**Commit:** df8861f
**Applied fix:**

- The network lane no longer turns the user's list into `-c` bans. `userProtocolList()` passes the user's `GIT_ALLOW_PROTOCOL` on without `ext`, `fd`, `git`, `ftp`, and `ftps`, the transports the lane always bans. Names compare exactly, and empty names are dropped.
- A list left with no name becomes `/`, which allows nothing, as upstream's lane writes it.
- On Windows a transport stays only when every spelling's list names it.
- I chose this over the review's `protocol.allow=never` plus `protocol.<name>.allow=always` because, in git, the environment variable beats every config scope. A user config `protocol.<name>.allow=always` for an unlisted name would have re-allowed that name under the review's form. The `LaneRules.bans` hook is now `derived` (environment variables read from the user's environment), and `gitArguments` no longer takes the base environment.

**How verified:**

- The behavior was first checked by hand on git 2.43. A helper that the list leaves out is refused (`transport 'foo' not allowed`), even with `protocol.foo.allow=always`. `/` and an empty list allow nothing. `ext` stays refused under `-c protocol.ext.allow=always` when the list leaves it out.
- Unit rows cover: unset, an undefined value, `https:ssh`, `ext:https` (gives `https`), remote helper names (kept), only banned names (gives `/`), empty (gives `/`), `HTTPS` (kept exactly), an empty segment, and the Windows spelling intersection.
- Real-git cases (run through the module): `foo::bar` under `GIT_ALLOW_PROTOCOL=https:file` and a config `protocol.foo.allow=always` rejects as `protocol-refused`. The old module fails this case: it rejects as `failed` because it tries `git-remote-foo`. A listed `file://` URL still lists. `fd::0`, `git://`, `ftp://`, and `ftps://` stay refused when both the user's list and a user config `protocol.<name>.allow=always` allow them, and `ext::` stays refused.

### WR-03: `run()` and `locate()` reject with raw filesystem errors

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/git-process.test.ts`
**Commit:** 7a8f9d5
**Applied fix:**

- A request directory whose real path cannot be read now rejects as a `failed` GitCommandError, with the filesystem error as its cause, before any launch. This goes through `workingDirectory()`, and `failsBeforeLaunch()` is shared with the neutral-directory failure.
- In the Windows lookup, a Pi working directory with no readable real path is compared as given. A candidate whose directory has no readable real path is skipped.
- On macOS, a found git whose real path cannot be read gives `git-missing` (`not-found`), as a git that is gone does.

**How verified:**

- The E11 case now expects the `failed` GitCommandError with the ENOENT cause.
- New cases cover the two Windows rows and the macOS row. Each of them failed before the fix with a bare ENOENT.
- Direct coverage of the pair is 100%.

### WR-04: Stdout is cut at 8 MiB with no signal

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/platform/process-run.ts`, `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/process-run.test.ts`, `test/platform/git-process.test.ts`, `test/platform/package-manager.test.ts`
**Commit:** b0df727
**Applied fix:**

- `ProcessRun` has an optional `truncated: readonly ("stdout" | "stderr")[]`. It lists each stream that wrote more than its capture keeps, in the order stdout, stderr, and it is absent when every character was kept. This counts the character that the decoder completes at the end.
- In `settleRun`, a git run that would otherwise resolve rejects as `failed` when its stdout was cut. Its cause is a `RangeError` with the message "git wrote more than 8388608 characters to stdout, so its answer is incomplete". I chose to reject rather than add a flag that callers must check.
- The package manager's runs carry the same field. Its test expects it on the run that outgrows 65,536 characters.

**How verified:**

- New process-run cases: streams that fit exactly report no cut, only stdout cut reports `["stdout"]`, and a character completed at the end counts toward the capture.
- The existing capture cases now expect `truncated`.
- New git-process cases: a stdout of exactly 8,388,608 characters resolves whole, and 8,388,609 characters under an allowed exit rejects as `failed` with the RangeError cause.
- Direct coverage of `process-run.ts`, `package-manager.ts`, and `git-process.ts` is 100%.

### WR-05: `NODE_CREDENTIAL_GIT` exports a full git runner

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/platform/git-credential.ts`, `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`, `test/platform/git-credential.test.ts`, `test/orchestrators/auth-host.test.ts`
**Commit:** 8617ea5
**Applied fix:**

- `CredentialGit` is now `(action: "fill" | "approve" | "reject", input: string, timeoutMs: number) => Promise<string>`.
- `NODE_CREDENTIAL_GIT` is a function inside git-credential.ts. It runs `NODE_GIT_PROCESS.run({ subcommand: "credential", options: [action], lane: "network", input, timeoutMs })` and returns its stdout.
- No module that may import git-credential.ts can reach any other git request through it, so the GIT_PROCESS_IMPORTERS zone keeps its meaning.
- `createCredentialOps` calls the runner directly. The comments in auth-host.ts and git-credential.ts say the same.

**How verified:**

- `@ts-expect-error` cases show that a `{ subcommand: "clone" }` request and an `erase` action do not fit the port.
- The protocol cases record `{ action, input, timeoutMs }`.
- A real-git case runs `NODE_CREDENTIAL_GIT("fill", ...)` in a hermetic Pi home, with `GIT_CONFIG_NOSYSTEM=1` and a user config whose helper answers. The case saves and restores the variables, and it gets the complete wire response. It passes both in the hermetic environment and in the sandbox's full environment.
- Direct coverage of both pairs is 100%.

### WR-06: A network command's timeout budget can double, and the version read ignores cancellation

**Status:** fixed: requires human verification (timing logic; the cases discriminate under mock timers)
**Files modified:** `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/git-process.test.ts`
**Commit:** 22eb576
**Applied fix:**

- `GitProcessHost` gains `now()`, which is `performance.now()` in `NODE_GIT_HOST`.
- `run()` takes one deadline when it starts. The ssh read and the command each get only `deadline - now()`, through `timeLeft()`.
- The timeout error still names the request's limit. A command with no time left rejects as `timeout` and launches nothing.
- After `git-too-old`, the version read carries the failed request's signal.
- The kill escalation (up to 2x `killGraceMs` for each launch) still adds to the total. That cost is IN-03's subject, which is out of scope.

**How verified:**

- New cases: with a request of 100 ms and an ssh read that took 30 ms, nothing is signalled at 69 ms, SIGTERM goes out at 70 ms, and the run rejects as `timeout` with a limit of 100.
- A read that uses up all of the time starts no second launch.
- Cancelling during the version read stops it within the kill grace and logs `git version: unreadable`, and the run rethrows `git-too-old`.
- The `NODE_GIT_HOST` clock reads values that never go back.
- Mutation checks: with the full timeout given to the command, or with no signal on the version read, all three cases fail. They are written to fail fast rather than hang.

### IN-02: The ssh config read parses newline-separated output

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/platform/git-process.ts`, `test/platform/git-process.test.ts`
**Commit:** 0745f86
**Applied fix:**

- The read is now `config --get-regexp --null`. The operation name stays `config --get-regexp`.
- `configValues()` splits the output into records at NUL, and splits each record at its first newline into the key and the value. A CR before that newline is dropped.
- A key set with no value counts as unset, as an empty value does.

**How verified:**

- The format was checked on git 2.43: `key\nvalue\0`, and `key\0` for a key with no value.
- The composition rows answer with NUL records.
- A new row shows that a `core.sshCommand` value holding `\nssh.variant tortoiseplink` forges no `ssh.variant`. The batch options are still added, and no variant is exported.
- The real-git ssh cases, for example the user's `core.sshCommand` with `-i <key>`, run the new read against real git.

## Skipped Issues

### IN-01: The git-required gate uses a module-global git process; the tests mutate process.env.PATH

**File:** `extensions/pi-claude-marketplace/platform/git.ts:574, 621, 697, 769`; `test/platform/git.test.ts:425`
**Reason:** out of scope by the orchestrator's instruction. The transport phase (Phase 3) replaces that gate and transport.
**Original issue:** the four gates call the module-level `NODE_GIT_PROCESS.locate()` and take no injected collaborator, and the suite rewrites `process.env.PATH` to test them.

### IN-03: A terminated run always waits out the whole kill escalation and then signals a group that may be gone

**File:** `extensions/pi-claude-marketplace/platform/process-run.ts:204-207, 282-287`
**Reason:** out of scope by the orchestrator's instruction (kill grace timing).
**Original issue:** after SIGTERM, a `close` settles only at `abandon`, 2x `killGraceMs` later, and SIGKILL goes to `-pid` even when the group is gone.

## Follow-ups for the orchestrator

- **Windows-only branches not run on Windows.** These new branches have unit cases with a fake win32 host only:
  - CR-01 skips the owner and mode checks where `process.getuid` is undefined.
  - WR-02 keeps only the transports every `GIT_ALLOW_PROTOCOL` spelling names.
  - WR-03 handles real-path failures in the Windows lookup.

  Either fold them into the open entry 120 (the manual macOS and Windows check), or record them separately:
  `node .claude/gsd-core/bin/gsd-tools.cjs windows append --kind unrun-verify --phase 2 --file extensions/pi-claude-marketplace/platform/git-neutral-directory.ts --description "[system-git] the Windows branches added by the code-review fixes (neutral directory without owner/mode checks, GIT_ALLOW_PROTOCOL spelling intersection, lookup with unreadable real paths) have fake-host unit cases only; the manual Windows check covers them"`
- **Marker count unchanged.** No `fallow-ignore` marker was added or removed. The CONVENTIONS count of 54 and entry 118 still hold.
- **Combined-tree gate.** `npm run check` on the combined tree is left to the phase gate.

---

_Fixed: 2026-11-23T20:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
