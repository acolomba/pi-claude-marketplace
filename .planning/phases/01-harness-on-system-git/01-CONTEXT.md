# Phase 1: Harness on System Git - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The unit, integration, and cucumber suites build every fixture repository and
run every test-side git operation with the system `git` binary, under an
environment built from scratch so that no user, system, or sandbox-injected git
configuration (the cloud sandbox's `GIT_CONFIG_COUNT` `insteadOf` rewrites
included) reaches a process the suites start. The cucumber HTTPS git-host
stand-in is trusted by system git and serves fetch by SHA, with a refusing arm.
A new SSH stand-in answers both git's SSH transport and an `ssh` probe launch
with scripted answers and no real network. `hermetic-git-environment.test.ts`
covers every variable SG-HRN-04 names, and CI logs the git version.

The product does not change: it still clones with `isomorphic-git`, so no
cucumber request table changes in this phase. Only the harness's own checks
use the system-git CA trust and the SSH stand-in until Phase 3. The
requirements are SG-HRN-01, SG-HRN-02, SG-HRN-03, and SG-HRN-04.

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [Hermetic environment] Q: "How does a test-side git command get its environment?" → Selected: "Every git command the suites run (fixtures, inspection, the git host's CGI, the SSH stand-in's upload-pack, the harness's own checks) gets an environment built from scratch, never a filtered copy of process.env: PATH, a scratch HOME, GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL=/dev/null, fixed author and committer identity, and nothing else unless the call adds a named variable. This extends today's hermeticGitEnvironment (DRV-03)." — test-only support code; one builder changes in one place.
- [Hermetic environment] Q: "Where does the one environment builder live?" → Selected: "Keep features/lib/hermetic-git.ts (hermeticGitEnvironment, runGit) as the suite-wide builder, and have the unit and integration fixture code import it, so the unit, integration, and cucumber suites share one builder and one key set." — moving a module later is a mechanical import change.
- [Hermetic environment] Q: "Which processes count as 'a test process' for SG-HRN-04?" → Selected: "Every process the suites start: fixture and inspection git, the git host's CGI, Pi under cucumber (rpcChildEnvironment and the real-subagent child), the SSH stand-in, and integration-test child processes. The node test-runner process itself is not scrubbed in this phase: the product still uses isomorphic-git, which reads no git configuration. When Phase 2 or 3 lets production code spawn git inside a unit test, that phase decides how the test gives it a hermetic base environment (an injected environment, per the dependency-injection convention, or a test preload)." — the scrub boundary is test support code that a later phase can widen.
- [Hermetic environment] Q: "Which variables does the hermetic test check?" → Selected: "INHERITED_VARIABLES grows to cover the whole GIT_CONFIG family (GIT_CONFIG_COUNT, GIT_CONFIG_KEY_n, GIT_CONFIG_VALUE_n, GIT_CONFIG_PARAMETERS), GIT_SSL_CAINFO, GIT_SSH, GIT_SSH_COMMAND, GIT_SSH_VARIANT, SSH_AUTH_SOCK, SSH_ASKPASS, the proxy variables in both cases (HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, NO_PROXY), XDG_CONFIG_HOME, GIT_TRACE*, GCM_*, and CLAUDE_CODE_PLUGIN_PREFER_HTTPS, on top of today's list. The test asserts each builder's exact key set, as it does now, so a new inherited key fails it." — a test list; adding or removing a row is local.
- [Fixtures on system git] Q: "What moves to system git in this phase?" → Selected: "Every test-side git operation: fixture creation (init, add, commit, tag, branch, bare repositories, packs) and every inspection of a clone the product made (resolving refs, reading logs, listing tags, reading config). test/platform/git-test-repository.ts keeps its exported API (dir, gitdir, initialOid, commit, pack) and is reimplemented on system git; the inline isomorphic-git calls in the other test files move onto a shared system-git helper. A test file may still import isomorphic-git only when it exercises the production module's isomorphic-git contract (for example a double for the platform/git.ts HTTP client that Phase 3 deletes); Phase 3 or Phase 8 removes those last imports." — test code only; the production module is untouched.
- [Fixtures on system git] Q: "How are fixture commits kept deterministic?" → Selected: "Fixed author and committer identity and fixed dates (GIT_AUTHOR_DATE and GIT_COMMITTER_DATE from a counter, as the isomorphic-git builder used 1_700_000_000 + n), init.defaultBranch=main, commit.gpgsign=false. A test that pinned a literal object id from the isomorphic-git builder reads the id from the fixture instead of pinning the new literal." — fixture details; a pinned literal can be re-read later at no cost.
- [Fixtures on system git] Q: "Sync or async git calls in test support?" → Selected: "Async execFile or spawn with an argument array and no shell, as runGit does, because a sync call blocks the worker that may also serve the git host; the pack() helper uses git pack-objects with its input on stdin." — call style inside test helpers.
- [HTTPS stand-in] Q: "How does system git trust the HTTPS stand-in?" → Selected: "GIT_SSL_CAINFO=<the run's certificate> in RpcGitEnvironment and in the harness's own git checks, not http.sslCAInfo in the sandbox .gitconfig: DRV-03 requires that file to be absent until a scenario writes it, and GIT_SSL_CAINFO in the environment outranks the config key (research E-16c). NODE_EXTRA_CA_CERTS stays for the Node fetch paths (hosted manifests, Device Flow)." — one environment key in the harness.
- [HTTPS stand-in] Q: "How does the stand-in serve fetch by SHA, and how does the refusing arm refuse it?" → Selected: "By default the CGI keeps passing GIT_PROTOCOL, so protocol v2 serves any want, a non-tip commit included (research E-2); the default arm also allows reachable-SHA wants for a protocol v0 client, as GitHub does. A new refusing arm, set per repository like the existing arms, serves that repository with protocol v0 (no GIT_PROTOCOL passthrough) and with uploadpack.allowAnySHA1InWant and uploadpack.allowReachableSHA1InWant false, so fetch origin <sha> fails with git's 'Server does not allow request for unadvertised object'. Phase 3 drives the --unshallow fallback with it." — a stand-in arm; arms are test support code.
- [SSH stand-in] Q: "Stub ssh on PATH, or GIT_SSH_COMMAND?" → Selected: "A stub executable named ssh in a per-run directory placed first on Pi's PATH (and on the PATH of the harness's own SSH checks). GIT_SSH_COMMAND and GIT_SSH stay unset, because upstream reads a set GIT_SSH_COMMAND or GIT_SSH as the probe-skip signal on the plugin CLI install path, so a stub through them could not test the probe path (research Pitfall 9)." — harness wiring that a later phase can change.
- [SSH stand-in] Q: "What does the stub answer?" → Selected: "It parses ssh's argv (-o options, -p, -T, -G, -4, -6, -v, the destination, the remote command). For a git transport command (git-upload-pack '<path>') to a host:path that the run registered, it runs git upload-pack on the same bare repository the HTTPS stand-in serves, in the hermetic environment, passing GIT_PROTOCOL through for protocol v2. For the probe (ssh -T git@<host>) it answers per host from a scripted arm: authenticated (stderr 'Hi <user>! You've successfully authenticated, but GitHub does not provide shell access.', exit 1), denied ('git@<host>: Permission denied (publickey).', exit 255), host key ('Host key verification failed.', exit 255), or hold (no answer until killed, for the probe timeout). For ssh -G <destination> it prints a config with hostname and no proxycommand or proxyjump, or a proxy arm's line. An unregistered host fails like an unreachable host (exit 255), so no scenario can reach a real ssh, and every launch is appended to a request log that steps can read." — scripted answers are test support data.
- [SSH stand-in] Q: "Is the stub always installed?" → Selected: "Yes: every cucumber Pi gets the stub first on PATH, armed or not, so a developer's real ssh and SSH agent are never reached; SSH_AUTH_SOCK never reaches Pi. Reproducing 'no ssh on PATH' (an upstream not-configured case) is left to Phase 4, because ssh and git often share one directory on PATH." — wiring default; one line to change.
- [SSH stand-in] Q: "In what language is the stub written?" → Selected: "A Node script with a shebang, in the TypeScript harness's style where the runtime allows (a .mjs entry if Node cannot run the .ts file directly as an executable), launched with an absolute node path so that it does not depend on the PATH order it shadows." — an implementation detail of one test file.
- [Harness self-checks] Q: "Where do the harness's own system-git checks live (CA trust clone and SHA fetch, the refusing arm, the SSH clone and probe)?" → Selected: "Next to the existing harness self-checks: unit tests of the features/lib modules under test/, which the source-test pairing already expects, and no new feature file, because no /claude:plugin behavior changes in this phase (the AGENTS.md behavioral-test rule applies to user-visible behavior)." — test placement.
- [CI and measurement] Q: "Which CI jobs log the git version, and how?" → Selected: "A 'git --version' step before the tests in every ci.yml job that runs a test suite (static, integration, behavioral, direct-coverage, e2e-tests) and in e2e-nightly.yml. lint.yml's jobs run git only for tooling, not for tests, and get no step." — a CI step; removing it is local.
- [CI and measurement] Q: "Does the e2e suite set CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1 now?" → Selected: "Yes, as its own run variable (the shell's value still never leaks), so the e2e transport is deterministic once Phase 4 makes the product read it; it changes nothing before then." — one variable in one suite.
- [CI and measurement] Q: "How is the Phase 3 re-baseline count recorded?" → Selected: "The phase counts the 'the git host receives these requests' tables (79 tables in 19 files when this context was written) and every other step that asserts git-host traffic, and records the exact count and file list in its SUMMARY.md and in STATE.md for Phase 3." — a number in a record.

### Claude's Discretion
None: no question was delegated. Every question above was a reversible technical choice.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/hermetic-git.ts`: `hermeticGitEnvironment(home)` (eight keys: PATH, HOME, GIT_CONFIG_NOSYSTEM, GIT_CONFIG_GLOBAL=/dev/null, author and committer) and `runGit(cwd, home, ...args)` (async execFile with `-c init.defaultBranch=main -c commit.gpgsign=false`). This is the base for the shared builder.
- `features/lib/https-git-host/server.ts` and `cgi.ts`: a loopback `node:https` server with a fresh P-256 certificate that serves bare repositories through `git http-backend` CGI, with `GIT_PROJECT_ROOT`, `GIT_HTTP_EXPORT_ALL`, and `GIT_PROTOCOL` passthrough. It already has per-repository arms (`status`, `drop`, `hold`, `hold-git-body`, `credential`, `invalid-response`, `redirect`) and a request log with windows. The refusing arm joins `GitHostArm`.
- `features/lib/git-marketplace.ts`, `git-plugin.ts`, `git-clones.ts`: the cucumber fixture and inspection helpers, already on system git through `runGit`.
- `test/platform/git-test-repository.ts`: the unit fixture builder on isomorphic-git (`createGitTestRepository`, `createGitTestDirectory`, `boundary: "local"`, `commit`, `pack`).

### Established Patterns
- DRV-03: every environment the suite builds is made from scratch. `rpcChildEnvironment` (`features/lib/pi-rpc.ts:192`) gives Pi only `PATH`, the sandbox `HOME`, the run's `NODE_EXTRA_CA_CERTS`, `GIT_CONFIG_NOSYSTEM=1`, and `GIT_CONFIG_GLOBAL=<sandbox home>/.gitconfig`, which stays absent until a scenario writes it (`features/support/pi-process.ts:150-156`).
- `test/architecture/hermetic-git-environment.test.ts` asserts exact key sets and an `INHERITED_VARIABLES` list that the shell sets before each case.
- About 36 test and feature files mention `isomorphic-git` (34 import it). `features/lib/github-device-flow/extension.ts` and two architecture tests mention it only in comments or strings.

### Integration Points
- `RpcGitEnvironment` (`features/lib/pi-rpc.ts:49`) gains `GIT_SSL_CAINFO`. Pi's `PATH` gains the SSH stand-in directory first.
- `features/lib/https-git-host/cgi.ts:48-59` is where the refusing arm drops `GIT_PROTOCOL` and sets the upload-pack configuration.
- `.github/workflows/ci.yml` and `.github/workflows/e2e-nightly.yml` get the git version step.

### Sandbox facts (2026-11-23)
- git 2.43.0. No `ssh` binary on PATH.
- The environment sets `GIT_CONFIG_COUNT=3`: `credential.interactive=false` and two `url.https://github.com/.insteadOf` rows (`git@github.com:`, `ssh://git@github.com/`). It also sets `GIT_SSL_CAINFO=/root/.ccr/ca-bundle.crt`, `GIT_ASKPASS=` (empty), `GIT_TERMINAL_PROMPT=0`, `GIT_EDITOR=true`, and the HTTP proxy variables. Running `npm run check` here is the success-criterion-2 test.

</code_context>

<specifics>
## Specific Ideas

Upstream evidence record for the SSH stand-in (Claude Code 2.1.330 binary at `/opt/claude-code/bin/claude`, re-checked 2026-11-23; first read in `.planning/research/FEATURES.md` E-SG-01):

- Probe argv: `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com`, `{cwd:Jut(),timeout:3000}`. Success needs `e.code===1&&o.includes("successfully authenticated")`. A not-configured answer is exit 255 with `includes("Permission denied (publickey")||e.includes("Host key verification failed")`.
- Proxy check: `kt("ssh",["-G","git@github.com"],{cwd:Jut(),timeout:5000})`.
- Transport: upstream pins `-c core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes` (or appends those options to the user's own ssh command; `-batch` for plink). So the stub must accept `-o BatchMode=yes -o StrictHostKeyChecking=yes` on transport calls.

Research the planner should reuse: `.planning/research/PITFALLS.md` Pitfall 9 (the harness works for the wrong reason) and Pitfall 2 (the sandbox's `GIT_CONFIG_COUNT`), experiments E-2, E-2b, E-15, E-16, E-16c; `.planning/research/ARCHITECTURE.md` build order step 1 and the test-harness rows; `.planning/research/SUMMARY.md` "Phase 1: Harness readiness on system git".

</specifics>

<deferred>
## Deferred Ideas

- Scrubbing the node test-runner process's own environment (a preload or an injected base environment for production git spawns in unit tests): Phase 2 or Phase 3, when production code first spawns git.
- Reproducing "no ssh on PATH" in cucumber: Phase 4.
- Re-baselining the cucumber request tables: Phase 3.

</deferred>
