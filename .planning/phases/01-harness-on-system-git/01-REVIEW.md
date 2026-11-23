---
phase: 01-harness-on-system-git
reviewed: 2026-11-23T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/e2e-nightly.yml
  - features/lib/git-clones.ts
  - features/lib/hermetic-git.ts
  - features/lib/https-git-host/cgi.ts
  - features/lib/https-git-host/server.ts
  - features/lib/pi-rpc.ts
  - features/lib/real-subagent-child.ts
  - features/lib/ssh-git-host/host.ts
  - features/lib/ssh-git-host/launch.ts
  - features/lib/ssh-git-host/stub.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/subagent-hooks.steps.ts
  - features/support/pi-process.ts
  - package.json
  - test/architecture/hermetic-git-environment.test.ts
  - test/architecture/https-git-host-cgi.test.ts
  - test/architecture/https-git-host-server.test.ts
  - test/architecture/ssh-git-host.test.ts
  - test/e2e/upstream-marketplace.ts
  - test/integration/concurrent-install.test.ts
  - test/integration/ipc-child-environment.ts
  - test/integration/load-reconcile-race.test.ts
  - test/integration/marketplace-add-seed-mirrors.test.ts
  - test/integration/path-source-tag-install.test.ts
  - test/integration/pi-subagents-child-identity.test.ts
  - test/integration/project-install-adds-user-marketplace.test.ts
  - test/integration/subagent-hook-ownership.test.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/list-candidate-row.test.ts
  - test/orchestrators/plugin/list-flow.test.ts
  - test/orchestrators/plugin/marketplace-tag-probe.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/plugin/warm-mirror-seed.ts
  - test/platform/git-test-repository.ts
  - test/platform/git.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
  necessity: 1
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

The phase moves the unit and integration fixtures from isomorphic-git to the system `git` binary under a from-scratch environment. It adds a SHA-refusing arm and CA trust to the HTTPS git-host stand-in, and a stub `ssh` stand-in for git's SSH transport.

I read the new modules in full (`hermetic-git.ts`, `cgi.ts`, `ssh-git-host/{host,launch,stub}.ts`, `git-test-repository.ts`, `ipc-child-environment.ts`, `hermetic-git-environment.test.ts`, `ssh-git-host.test.ts`) and the diffs of the rest. I ran `ssh-git-host.test.ts`, `hermetic-git-environment.test.ts`, `https-git-host-{server,cgi}.test.ts`, and `git.test.ts` locally on Node 22.23.5 and git 2.43.0. All 202 cases passed.

Checks that came back clean:

- **Path containment.** The SSH stand-in's `servedRepository` rejects `..`, `//abs`, quotes, and NUL, and the test proves a real `outside.git` is refused by the stub itself.
- **CGI traversal.** I tried an encoded traversal (`..%2f..%2f`) through the HTTPS host's `PATH_INFO`. `git http-backend` refuses it as "aliased".
- **Shell injection.** The wrapper script single-quotes its three paths and throws on a quote. Host names are limited to `[A-Za-z0-9.-]` and looked up with `Object.hasOwn`.
- **Environment leaks.** The planted-variable tests would fail on a leak. Each rewrite is keyed the right way round (replacement in the key, matched prefix in the value), so the "clone succeeds only when nothing leaked" proofs are not vacuous.

No Critical findings. The two Warnings concern a leaked-process risk and a timing-sensitive test. The Info items are fidelity gaps and robustness notes.

Necessity: `necessity-review.md` was read. One judgment-based finding is tagged below.

## Warnings

### WR-01: A held probe stub has no bound on its own lifetime, so a caller that dies leaves it running

**File:** `features/lib/ssh-git-host/stub.ts:114-124`
**Issue:** For a `hold` arm the stub installs `setInterval(() => undefined, 60_000)` and never exits on its own. It ends only when its caller sends a signal. If the caller is SIGKILLed or crashes (a Pi that is killed mid-probe, or a cucumber worker that is torn down), the stub keeps running forever as an orphan.

`SshGitHost.reset()` and `close()` then only report the pid by failing after 5 s. They never end the process (`host.ts:132-150`). On a developer machine or a long-lived CI runner, orphaned `node` stubs accumulate. Each one also fails the next scenario's `Before()` reset until it is killed by hand. The module header promises "no held stub outlives its scenario", but nothing enforces it beyond the caller's cooperation.

**Fix:** Bound the hold inside the stub. Exit when the launch's parent goes away, or after a hard cap that is longer than any probe timeout the suite uses:
```ts
const HOLD_LIMIT_MS = 5 * 60_000;

function answerProbe(destination: string, arm: SshHostArm): void {
  const answered = probeAnswer(arm.probe, destination);
  if (answered === "hold") {
    const parent = process.ppid;
    const timer = setInterval(() => {
      if (process.ppid !== parent) {
        process.exit(SSH_FAILURE);
      }
    }, 1_000);
    setTimeout(() => process.exit(SSH_FAILURE), HOLD_LIMIT_MS).unref();
    void timer;
    return;
  }
  ...
}
```
`SshGitHost.close()` could also `SIGKILL` the pids it names after it reports them. That is safe only if the pid is first checked against the launch record, to avoid pid reuse.

### WR-02: The held-probe test kills the stub 300 ms after spawn, which can race the stub's own startup

**File:** `test/architecture/ssh-git-host.test.ts:458-469`
**Issue:** `runSsh(host, [...PROBE_OPTIONS, "git@hold.test"], 300)` has `execFile` SIGTERM the wrapper (same pid as the stub, because of `exec`) 300 ms after spawn. The stub records its launch only after Node starts, type-strips `stub.ts` and `launch.ts`, and imports `hermetic-git.ts`. I measured about 60 ms on an idle 4-core box.

On a loaded CI runner that startup can exceed 300 ms. The kill then lands before `recordLaunch`, `launchesSince(window)` returns `[]`, and `assert.ok(launch !== undefined && !isRunning(launch.pid))` fails. The failure message points at the stub and not at the timing. The sibling test at line 471 uses `firstLaunchSince` to wait for the launch record first, which is the right pattern.

**Fix:** Wait for the launch record before applying the timeout. Spawn the held probe the way the line-471 test does, wait with `firstLaunchSince`, then `kill("SIGTERM")` and await exit. Or raise the `runSsh` timeout to something safely above a loaded-runner startup (for example `LAUNCH_TIMEOUT_MS`) and assert on `run.killed`.

## Info

### IN-01: `ssh -G` for an unregistered host fails, where real OpenSSH always prints a config

**File:** `features/lib/ssh-git-host/stub.ts:135-146`
**Issue:** `answer` resolves the host arm before it checks `launch.printConfig`. `ssh -G git@github.com` for a host the run did not register therefore exits 255 with "Could not resolve hostname". Real `ssh -G` never resolves the name and always prints the config and exits 0. The header says the stub models what Claude Code 2.1.330 reads, and that client runs `ssh -G` first to look for a proxy line. A scenario that forgets to register the host would see a failure mode real ssh cannot produce, and it would not reach the probe answer it meant to test. No product code runs `ssh -G` yet (`grep` of `extensions/` is empty), so there is no live impact.
**Fix:** Answer `-G` before the host lookup. Use the arm's `proxy` when the host is registered, and no proxy line when it is not.

### IN-02: The stub's header says it reads only `GIT_PROTOCOL` from its environment, but it also reads `PATH`

**File:** `features/lib/ssh-git-host/stub.ts:14-15`, `features/lib/hermetic-git.ts:39`
**Issue:** `uploadPackEnvironment` goes through `hermeticGitEnvironment`, which takes `PATH: process.env.PATH`. The stub's own env therefore decides where `git upload-pack` is found. The comment ("Of its own environment it reads only `GIT_PROTOCOL`") and the `launch.ts` text ("and nothing else") are slightly wrong. The tests (`hermetic-git-environment.test.ts:188`) correctly expect `PATH` as a base key.
**Fix:** Reword both comments to "`GIT_PROTOCOL` and `PATH`".

### IN-03: `readGitClones` has no direct test, and its "origin unset" branch is unexercised

**File:** `features/lib/git-clones.ts:55-65`
**Issue:** The rewrite from parsing `.git/config` to `git config --get remote.origin.url` turns the "no origin url" assertion into an `error.code === 1` check on an `execFile` rejection. Nothing under `test/` imports `git-clones.ts` (only `installation.steps.ts` does). A change in git's exit code, or in how `promisify(execFile)` exposes it, would silently turn the intended `assert.fail` message into a raw `Command failed` error. A clone with no `.git` exits 128 and is rethrown as a raw error. That matches the new header comment, but it is also unasserted.
**Fix:** Add a small `test/architecture` case. Build one clone with an origin, one without, and one with no `.git`, and assert `readGitClones` returns, fails with the origin message, and fails respectively.

### IN-04: No minimum system-git version is asserted, and some tests depend on git's exact output

**File:** `.github/workflows/ci.yml` (the five added "Show the git version" steps), `test/architecture/https-git-host-server.test.ts` (`/Server does not allow request for unadvertised object/`), `test/platform/git-test-repository.ts:65` (`init.defaultBranch`)
**Issue:** CI now logs `git --version` (SG-HRN-04), but nothing fails on an unsupported version. The harness silently relies on:

- `init.defaultBranch` (git 2.28 and later; an older git ignores it and creates `master`);
- protocol v2 as the default (2.26 and later);
- `%(refname:lstrip=3)` (2.13 and later);
- git's wording for a refused unadvertised want.

A developer with an older or newer git would get failures that look like product bugs.
**Fix:** Have `hermetic-git.ts` (or a one-time guard in the architecture tests) check `git --version` against a stated floor and fail with a clear message. Or document the floor next to the Node engines range. Keep the message regex loose, for example `/unadvertised object/`.

### IN-05: The SSH stand-in's probe, `-G`, and proxy arms have no consumer outside their own tests

**File:** `features/lib/ssh-git-host/host.ts:95-111`, `features/lib/ssh-git-host/launch.ts:28-39,191-246`
**Category:** necessity
**Issue:** The only call sites of `SshGitHost` are `features/support/pi-process.ts` (start, reset, close, snapshot), `ssh-git-host.test.ts`, and `hermetic-git-environment.test.ts`. No step definition calls `register`. The `authenticated`, `denied`, `host-key`, and `hold` probe arms, the `proxy` line, and `probeAnswer` and `configLines` serve behavior that no product code and no scenario reaches in this phase (`extensions/` contains no `ssh` invocation). This looks like intentional groundwork for the SSH clone work, and its tests are thorough. It is still generality without an instantiation in this phase, and it carries about 150 lines that the coverage gate must keep green. The repo does not show whether a later phase consumes it.
**Fix:** If the consuming phase is committed to, keep it, with a pointer in the header to the requirement that will use it. If not, drop the `hold`, `proxy`, and `-G` surface until a scenario needs it.

---

_Reviewed: 2026-11-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
