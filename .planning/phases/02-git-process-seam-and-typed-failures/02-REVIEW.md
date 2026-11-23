---
phase: 02-git-process-seam-and-typed-failures
reviewed: 2026-11-23T18:40:57Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - docs/json-output.md
  - docs/output-catalog.md
  - eslint.config.js
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/platform/git-credential.ts
  - extensions/pi-claude-marketplace/platform/git-failure-kind.ts
  - extensions/pi-claude-marketplace/platform/git-process.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - extensions/pi-claude-marketplace/platform/process-run.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - features/lib/user-git-programs.ts
  - features/marketplace/git-source.feature
  - features/marketplace/without-git.feature
  - features/plugin/without-git.feature
  - features/step_definitions/git-host.steps.ts
  - features/support/world.ts
  - rule-packs/architecture.json
  - schema/claude-plugin.schema.json
  - test/architecture/compat-01-no-expansion.test.ts
  - test/architecture/gate-targets.ts
  - test/architecture/no-credential-leak.test.ts
  - test/architecture/no-shell-out.test.ts
  - test/architecture/notify-closed-set-locks.test.ts
  - test/orchestrators/auth-host.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/platform/credential-process-fake.ts
  - test/platform/git-credential.test.ts
  - test/platform/git-failure-kind.test.ts
  - test/platform/git-process.test.ts
  - test/platform/git.test.ts
  - test/platform/package-manager.test.ts
  - test/platform/process-fake.ts
  - test/platform/process-group.ts
  - test/platform/process-run.test.ts
  - test/shared/errors.test.ts
  - test/shared/git-failure-classifiers.test.ts
  - test/shared/notification-types.test.ts
  - test/shared/notify-reasons.test.ts
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
  necessity: 0
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-23T18:40:57Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Scope: the diff `6c34252..HEAD` for the 46 files in the phase file list. I read the production modules in full: `platform/{git-process,git-failure-kind,process-run,git-credential,git,package-manager}.ts`, the `GitCommandError` and classifier changes, the `marketplace add` cause row, the gate edits (rule pack, ESLint BLOCK C), and the new cucumber features and steps. Tests were read only where they pin the behavior a finding is about.

The launcher (no shell, closed or written-then-closed stdin, EPIPE swallowed, process-group kill), the env and `-c` builder, the operand rules, and the closed-set reason plumbing are mostly sound. Two defects break the phase's own guarantees, and both were reproduced with git 2.43.0 in this sandbox:

1. The "neutral directory" is the shared system temp directory itself (`/tmp` on Linux). git discovers a repository planted at its root, so that repository's config can choose the credential helper and `core.sshCommand`.
2. The ssh wrapper hides the ssh program's base name from git. git then probes with `-G` and falls back to the `simple` variant for plink and TortoisePlink. TortoisePlink then runs without `-batch`, and any `ssh://host:port` URL fails.

The warnings cover these gaps: remote-controlled stderr can choose the failure kind, the user's `GIT_ALLOW_PROTOCOL` narrowing is only partly kept, raw non-`GitCommandError` rejections escape `run()` and `locate()`, stdout is cut off with no signal, the credential binding exports a full git runner, and the timeout budget can double.

Necessity was assessed against `.claude/gsd-core/references/necessity-review.md`. No finding met its evidence rule.

## Critical Issues

### CR-01: The neutral directory is the shared temp directory, so a repository planted at its root steers credential and ssh lookups

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:34-36, 384-390, 909, 954, 1000`
**Issue:** A request without `cwd` runs in `realpath(os.tmpdir())`, and the ceiling is set to its parent (`GIT_CEILING_DIRECTORIES=/` for `/tmp`). A ceiling stops git from climbing *above* the working directory, but git always checks the working directory itself. On Linux, `/tmp` is writable by every user. If any process creates `/tmp/.git`, or any user creates a bare layout (`/tmp/HEAD`, `/tmp/objects/`, `/tmp/refs/`, `/tmp/config`), git treats the neutral directory as a repository:

- `git credential fill/approve/reject` runs on the network lane, which has no `safe.bareRepository=explicit`. It reads that repository's `credential.helper` (for example `!cmd`), so the planted config can run code and receive the credential request. This is the exact thing SG-PRC-03 and the `git-credential.ts` header say cannot happen.
- The local-lane `git config --get-regexp` ssh read returns the planted `core.sshCommand`. The module then promotes that value into `GIT_SSH_COMMAND` for every network clone, fetch, and ls-remote.

Reproduced with git 2.43.0: a repository at the working directory with `GIT_CEILING_DIRECTORIES=<parent>` answers `core.sshcommand evil-ssh`. A bare layout is honored unless `safe.bareRepository=explicit` is set. git 2.35.2 and later refuse a repository that another user owns ("dubious ownership"). That protection is missing in three common cases: git older than 2.35.2 (the documented floor is 2.25, D-SG-06), a global `safe.directory=*` (common in containers and CI), and Pi running as root (for the bare layout, the git dir is `/tmp` itself, which root owns). The unit test `SG-PRC-03: never consults the credential helper of a repository enclosing the neutral directory` (git-process.test.ts:1574) covers only an *enclosing* repository, not the neutral directory itself.
**Fix:** Use a private, empty neutral directory below the temp directory. Then the ceiling (its parent, the temp directory) also keeps git out of `/tmp` itself:
```ts
// Created once per instance, mode 0700, then reused; never the shared tmpdir itself.
let neutralDirectory: Promise<string> | undefined;
function neutral(): Promise<string> {
  neutralDirectory ??= mkdtemp(path.join(host.tmpdir(), "pi-git-")).then((dir) => host.realpath(dir));
  return neutralDirectory;
}
// execute(): const cwd = request.cwd === undefined ? await neutral() : await host.realpath(request.cwd);
// sshChange(): const neutralDir = await neutral();
```
Also add `safe.bareRepository=explicit` to the pairs of both lanes (it is a protected key, so the user's own repositories are unaffected for `-C`-style runs). Add a real-git test that puts a repository *at* the neutral directory.

### CR-02: The ssh wrapper hides the variant from git, so plink and TortoisePlink run as `simple`: no `-batch` for TortoisePlink, and every URL with a port fails

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:484-497` (pinned by `test/platform/git-process.test.ts:2589-2614`)
**Issue:** The module wraps the user's command as `CDPATH= cd -- '<neutral>' ... ; <command> <options>`. Then git's `determine_ssh_variant` reads `CDPATH=` as the program's base name. The module computes the variant from the base name (`plink`, `tortoiseplink`) for its own options, but it exports `GIT_SSH_VARIANT` only when `ssh.variant` came from config. So git uses `VARIANT_AUTO`: it runs `<wrapped> -G ...`, plink and TortoisePlink reject `-G`, and git falls back to `VARIANT_SIMPLE`. Reproduced with git 2.43.0 and recording stand-ins:

```
wrapped tortoiseplink: ARGS: -G -o SendEnv=GIT_PROTOCOL -p 2222 git@example.invalid
                       fatal: ssh variant 'simple' does not support setting port
plain   tortoiseplink: ARGS: -batch -P 2222 git@example.invalid git-upload-pack '/x.git'
```

The consequences:
- TortoisePlink never gets the `-batch` that git adds only for `VARIANT_TORTOISEPLINK`, and the code relies on that (`SSH_VARIANT_OPTIONS` gives it `[]`). It can then open its GUI password or host-key dialogs, which breaks the phase's "cannot prompt" guarantee. Its rejection of `-G` may also show an error dialog of its own.
- Any `ssh://host:<port>/...` URL fails outright for plink and TortoisePlink, and git no longer translates the port to `-P`.
- Plain OpenSSH also pays an extra `ssh -G` launch on every network command.

The tests at 2589-2614 assert `variables: {}` for these rows, so they lock in the broken env.
**Fix:** Whenever the user set no `GIT_SSH_VARIANT`, export the variant the module resolved, so git and the module agree:
```ts
const resolved = userVariant ?? configVariant ?? baseVariant; // baseVariant from firstWord()
return {
  removed: ["GIT_SSH"],
  variables: {
    GIT_SSH_COMMAND: wrapped,
    ...(userVariant === undefined &&
      (configVariant !== undefined || KNOWN_VARIANTS.has(baseVariant.toLowerCase())) && {
        GIT_SSH_VARIANT: configVariant ?? baseVariant.toLowerCase(),
      }),
  },
};
// KNOWN_VARIANTS = new Set(["ssh", "plink", "putty", "tortoiseplink"])
```
Update the table rows to expect `GIT_SSH_VARIANT`. Add a real-git row with an `ssh://host:2222` URL and a recording `plink` and `tortoiseplink` that asserts `-batch -P 2222`.

## Warnings

### WR-01: Remote-controlled stderr lines can choose the failure kind; `xcrun: error:` anywhere reports a working git as missing

**File:** `extensions/pi-claude-marketplace/platform/git-failure-kind.ts:43-58, 61, 67-74, 95`
**Issue:** Most rows are unanchored substring matches over the whole stderr. That stderr includes `remote: ...` sideband lines from an https server, and over ssh it includes the server's raw stderr. A hostile or broken marketplace host can print `xcrun: error:`, `REMOTE HOST IDENTIFICATION HAS CHANGED`, `Permission denied (publickey`, or `Could not resolve host` and pick the kind. The `xcrun` row is the worst one. It is checked first, it turns any failure into `git-missing` (message "Git is required to install marketplaces."), and `backstop()` then drops the found-git cache (git-process.ts:884-886). A host-key-changed kind on an https URL would also make Phase 6 tell the user to edit `known_hosts`.
**Fix:** Anchor the git-side rows to line starts (`/^xcrun: error:/m`, and `/^fatal: .../m` where git writes the line). Before rows that describe local conditions (xcrun, dubious ownership, git-too-old, protocol-refused) are matched, classify on the text with `^remote: .*$` lines removed. Add corpus rows where a `remote:` line carries each spoofable phrase.

### WR-02: The network lane's translation of `GIT_ALLOW_PROTOCOL` drops the user's ban on every transport outside the four names

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:339-354, 372-377`
**Issue:** The network lane removes the user's `GIT_ALLOW_PROTOCOL` and re-bans only `https`, `http`, `ssh`, and `file`, plus the fixed ext/fd/git/ftp/ftps bans. A user with `GIT_ALLOW_PROTOCOL=https` meant "nothing else". After the translation, every remote helper (`<name>::...`, `persistent-https`, `hg`, `s3`, `codecommit`, and so on) falls back to git's default `user` policy, which allows it. The header claims the lane "keeps its narrowing as `-c` bans", and it does not. Reachability is low today because `domain/source.ts` accepts only `https://` and local paths. The SSH phase widens that.
**Fix:** When any spelling is set, emit `protocol.allow=never` first, then `protocol.<name>.allow=always` for each listed name that is not in the hard-ban set (ext, fd, git, ftp, ftps). The rest of git's policy stays with the user's own config.

### WR-03: `run()` and `locate()` reject with raw filesystem errors, which breaks the GitCommandError contract

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:717, 752, 909, 954`
**Issue:** `GitProcess.run` is documented as rejecting with a `GitCommandError`, and `locate` as rejecting with a `git-missing` one (lines 171-176). But `host.realpath(request.cwd ?? host.tmpdir())` (909, 954), `host.realpath(cwd)` in the Windows lookup (717), and `host.realpath(git)` in the macOS shim check (752) run unguarded. A deleted working directory, a deleted Pi cwd, or a `TMPDIR` that points nowhere therefore rejects with a bare `ENOENT`. The `platform/git.ts` gate passes that error through, and `classifyGitFailure` treats an `E*` code as a filesystem errno and leaves it unclassified. Callers that narrow by `instanceof GitCommandError` miss it.
**Fix:** Wrap the realpath calls:
```ts
const cwd = await host.realpath(request.cwd ?? neutralDir).catch((error: unknown) => {
  throw new GitCommandError({ kind: "failed" }, { operation }, { cause: error });
});
```
In `findGit`, map a lookup-time realpath failure to `gitMissing("not-found")` or to a `failed` GitCommandError.

### WR-04: Stdout is cut at 8 MiB with no signal, so a cut-off answer is parsed as complete

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:537, 826-827`; `extensions/pi-claude-marketplace/platform/process-run.ts:158-163`
**Issue:** `STDOUT_CAPTURE` keeps only the first 8,388,608 characters, and `GitResult` has no field that says the output was cut. Large-ref repositories (many PR or tag refs) can exceed this in an `ls-remote` or `for-each-ref`. The last line is then cut mid-record, and the caller (Phase 3's tag and ref readers) gets a silently incomplete or corrupt list, not a failure.
**Fix:** Track `truncated` per stream in `ProcessRun`. In `settleRun`, reject a run whose stdout hit the limit with a `failed` GitCommandError, or drop the stdout cap for git, whose callers need the whole answer.

### WR-05: `NODE_CREDENTIAL_GIT` exports a full git runner, so the GIT_PROCESS_IMPORTERS zone can be bypassed

**File:** `extensions/pi-claude-marketplace/platform/git-credential.ts:81, 88`; `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:45, 83`
**Issue:** `CredentialGit = Pick<GitProcess, "run">`, and `NODE_CREDENTIAL_GIT` is the production `NODE_GIT_PROCESS`. Any module that may import `platform/git-credential.ts` gets an unrestricted `run` that accepts any `GitRequest`, network clone and fetch included. That covers `orchestrators/auth-host.ts`, and also `edge/` and `bridges/`, which BLOCK F does not cover. This undoes the D-SG-01 zone, whose comment says other modules reach git only "behind CredentialOps".
**Fix:** Make the port credential-only, and keep the binding to `NODE_GIT_PROCESS` inside `git-credential.ts`:
```ts
export type CredentialGit = (action: CredentialAction, input: string, timeoutMs: number) => Promise<string>;
export const NODE_CREDENTIAL_GIT: CredentialGit = async (action, input, timeoutMs) =>
  (await NODE_GIT_PROCESS.run({ subcommand: "credential", options: [action], lane: "network", input, timeoutMs })).stdout;
```

### WR-06: A network command's timeout budget can double, and the version read ignores cancellation

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:552, 944-956, 960-966`
**Issue:** The ssh config read in `sshChange` gets the request's full `timeoutMs`, and the main run then gets the full `timeoutMs` again. Each run's kill escalation also adds up to 2x `killGraceMs`. So a clone, fetch, or ls-remote can run for about 2x `timeoutMs` + 4 s before it rejects. After a `git-too-old` failure, `run()` also waits for a 5 s `git version` read (`VERSION_REQUEST`) that is not tied to `request.signal`, so a cancelled operation can still wait for it before the original error is rethrown.
**Fix:** Take a deadline at the start of `execute` and give the ssh read and the main run only the time that is left. Pass `request.signal` to the version read, or run that read in the background without awaiting it before the rethrow.

## Info

### IN-01: The git-required gate uses a module-global git process; the tests mutate process.env.PATH

**File:** `extensions/pi-claude-marketplace/platform/git.ts:574, 621, 697, 769`; `test/platform/git.test.ts:425`
**Issue:** The four gates call the module-level `NODE_GIT_PROCESS.locate()` and do not take an injected collaborator. To test the gate, the suite rewrites the process-global `process.env.PATH`. That is the test-only global seam that CONVENTIONS ("Dependency injection over test-only seams") steers away from. It is safe only while the tests in this file run one at a time.
**Fix:** Pass a `locate` collaborator through `GitOps` (defaulting to `NODE_GIT_PROCESS.locate`), and have the tests pass a rejecting one.

### IN-02: The ssh config read parses newline-separated output

**File:** `extensions/pi-claude-marketplace/platform/git-process.ts:387, 453-466`
**Issue:** `git config --get-regexp` without `--null` prints a value that contains an escaped newline (`"\n"` in a config file) across two lines. The second line then parses as a separate key line, so such a value can forge a `core.sshcommand` or `ssh.variant` entry.
**Fix:** Add `--null` and split records on `\0` and key from value on the first `\n`.

### IN-03: A terminated run always waits out the whole kill escalation and then signals a group that may be gone

**File:** `extensions/pi-claude-marketplace/platform/process-run.ts:204-207, 282-287`
**Issue:** After SIGTERM, a `close` is recorded but not settled. The run settles only at `abandon`, which is 2x `killGraceMs` later, so every timeout or abort of git costs an extra 2 s. SIGKILL is also sent to `-pid` even when the whole group has already exited, which leaves a small window for pid and pgid reuse.
**Fix:** After `close`, settle early when the platform reports no living group members (POSIX `kill(-pid, 0)` throws ESRCH), and skip the SIGKILL in that case.

---

_Reviewed: 2026-11-23T18:40:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
