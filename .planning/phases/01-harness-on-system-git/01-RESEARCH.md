# Phase 1: Harness on System Git - Research

**Researched:** 2026-11-23
**Domain:** test harness (node:test fixtures, cucumber stand-ins, CI) on the system `git` binary
**Confidence:** HIGH (every load-bearing claim was re-run as an experiment in this sandbox on git 2.43.0 and Node v22.23.5, or read from the source file named beside it)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `01-CONTEXT.md` `## Implementation Decisions` / `### Decided autonomously`:

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

Upstream evidence the stub must honor (CONTEXT.md `<specifics>`, Claude Code 2.1.330): probe argv `ssh -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` with `timeout:3000`; success needs `e.code===1&&o.includes("successfully authenticated")`; not-configured is exit 255 with `Permission denied (publickey` or `Host key verification failed`; proxy check `ssh -G git@github.com` with `timeout:5000`; transport pins `-c core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes`.

### Claude's Discretion

None: no question was delegated. Every question above was a reversible technical choice.

### Deferred Ideas (OUT OF SCOPE)

- Scrubbing the node test-runner process's own environment (a preload or an injected base environment for production git spawns in unit tests): Phase 2 or Phase 3, when production code first spawns git.
- Reproducing "no ssh on PATH" in cucumber: Phase 4.
- Re-baselining the cucumber request tables: Phase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SG-HRN-01 | The unit, integration, and cucumber suites build their fixture repositories and run every git operation with the system `git` binary under a hermetic environment (no user, system, or sandbox-injected git config, including `GIT_CONFIG_COUNT`, reaches a test). | Importer inventory (18 files, classified) in "Fixture Migration Inventory"; OID parity proof (X1); `pack()` on `git pack-objects --revs` proven against the real `test/platform/git.test.ts` (X2, 124/124 pass); leak proofs for `GIT_CONFIG_COUNT` insteadOf (X5g), inherited `GIT_SSL_CAINFO` (X3-B), `XDG_CONFIG_HOME` (X7) |
| SG-HRN-02 | The cucumber HTTPS git-host stand-in is trusted by system git (`GIT_SSL_CAINFO` or `http.sslCAInfo`), serves fetch-by-SHA, and has a refusing arm for the fallback path. | X3 run against the real `HttpsGitHost`: clone with `GIT_SSL_CAINFO` only; v2 SHA fetch of a non-tip commit; v0 needs `uploadpack.allowReachableSHA1InWant=true`; v2 ignores the allow config, so the refusing arm must drop `GIT_PROTOCOL`; `git -c ... http-backend` carries the config to upload-pack; full clone and `--unshallow` still work under the refusing arm |
| SG-HRN-03 | The cucumber suite can drive the SSH probe and SSH transport through a stand-in (stub `ssh` on `PATH` or `GIT_SSH_COMMAND`) with no real network. | X5: exact argv git 2.43 hands a stub `ssh` (scp-like, `core.sshCommand`, `ssh://` with port), `GIT_PROTOCOL=version=2` in the stub's environment, no `ssh -G` from git itself, upload-pack v2 SHA fetch over the stub; X8: a timeout kill reaches the Node stub through an `exec` wrapper |
| SG-HRN-04 | `test/architecture/hermetic-git-environment.test.ts` fails when any git- or ssh-steering variable leaks into a test process, and CI logs the git version it ran. | Current test shape and `INHERITED_VARIABLES` read verbatim; builder inventory (every from-scratch environment the suites build); CI job inventory with line numbers |
</phase_requirements>

## Project Constraints (from AGENTS.md and its linked docs)

The repository has no `CLAUDE.md`; `AGENTS.md` and `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md` carry the directives. The ones that bind this phase:

- Never commit to `main`; branch `features/<name>` (current branch: `features/system-git`). Never rebase; merge. Commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- Every plan `SUMMARY.md` has a `## Threat Flags` section, even when "None".
- GSD gates (each wave's post-merge gate, the phase gate, the merge gate, the final handoff) run `npm run check` on the combined tree. A passing pre-commit hook (`check:commit`) is not a gate verdict. A quick task that commits a build input runs `npm run check` after its worktree merges.
- `npm run check` = `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) + `test:unpaired` + `test:integration` + `test:cucumber` (adapter then builtin) + `test:coverage:direct:all`. fallow is a mandatory member.
- A user-visible `/claude:plugin` change needs a failing-first cucumber scenario. This phase changes no user-visible behavior (locked: no new feature file).
- TypeScript strict; `explicit-module-boundary-types` on exported functions; `curly: all`; blank line after blocks; cognitive complexity 15 in both ESLint (sonarjs) and fallow health (`maxCognitive: 15`, `maxCyclomatic: 20`), which are computed independently.
- Comments and test titles cite durable IDs (`DRV-03`, `SG-HRN-02`, `D-...`), never `Phase NN` / `Plan NN` / `Wave N`.
- `fallow dupes --fail-on-issues` fails on every clone group (no threshold). Inline fixture rewrites that repeat the same `runGit` sequence across files will create clone groups.
- cucumber layout (`.agents/skills/cucumber/rules/layout.md`): `features/lib/<name>.ts` holds reusable code that registers nothing, named for the specific thing it stands in for; no catch-all names (`common`, `shared`, `utils`, `helpers`, `support`, `misc`, `hooks`); `features/support/` holds hooks; a stand-in whose trust or address Pi fixes at start lives in the same `PiRun` as Pi, is started by the same `BeforeAll()`, reset by `Before()` with an empty-snapshot assertion, and stopped by `AfterAll()`. `npm run check:features` enforces the names.
- No module-level mutable state under `features/` except the one run-state module (`features/support/pi-process.ts` `piRun`).
- Unit-test rules (`.agents/skills/typescript-unit-tests`): source-test pairing applies only to `extensions/pi-claude-marketplace/**` (`scripts/check-corresponding-tests.mjs:9` sets `nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"])`); test support lives next to the concern it serves (no `test/helpers/`, `test/utils/`); no test-only seams in production code.
- Upstream parity: Claude Code's behavior is the default; the stub's scripted answers are copied from the 2.1.330 strings in CONTEXT.md.

## Summary

The phase is pure test infrastructure, and the hard questions all have experiment answers in this sandbox. System git builds byte-identical commits to the current isomorphic-git builder when it gets the same identity and dates (X1), so moving the fixture builders cannot shift a single object id. A prototype `test/platform/git-test-repository.ts` on system git, with `pack()` on `git pack-objects --stdout --revs`, passed all 124 cases of `test/platform/git.test.ts` and `marketplace-tag-probe.test.ts` unchanged (X2), including the case that asserts two independently built repositories share commit ids, and the isomorphic-git product clones the system-git pack. A system-git warm mirror seed also passed its three consumer suites (one unrelated failure, below).

The HTTPS stand-in needs two changes and no rewrite. With `GIT_SSL_CAINFO=<run certificate>` in an environment built from scratch, system git clones and fetches a non-tip SHA over protocol v2 (three requests each: `GET info/refs`, `POST git-upload-pack` twice). An inherited environment fails (the sandbox's own `GIT_SSL_CAINFO=/root/.ccr/ca-bundle.crt` wins), and so does `NODE_EXTRA_CA_CERTS` alone (X3). Protocol v2 ignores `uploadpack.allow*SHA1InWant`, so the refusing arm must both drop `GIT_PROTOCOL` and set the two keys false. The config reaches upload-pack through `git -c key=value http-backend`, which keeps every `GIT_CONFIG_*` variable out of the CGI environment. The refusing arm fails a SHA fetch after one `GET` with `error: Server does not allow request for unadvertised object <sha>`, while a full clone and `fetch --unshallow` still succeed, which is the path Phase 3 needs (X3-H/I/J).

The SSH stand-in is a Node script behind a generated `#!/bin/sh` `exec` wrapper named `ssh`, first on PATH. git 2.43 hands it `-o SendEnv=GIT_PROTOCOL <user@host> "git-upload-pack '<path>'"` with `GIT_PROTOCOL=version=2` in its environment, adds `-p <port>` for `ssh://host:port/`, keeps `-o BatchMode=yes -o StrictHostKeyChecking=yes` ahead of its own options under upstream's `core.sshCommand`, and never runs `ssh -G` itself. A stub that runs `git upload-pack` with that `GIT_PROTOCOL` serves clone and a v2 SHA fetch (X5). In the sandbox's inherited environment, `git@github.com:` URLs are rewritten to HTTPS before ssh is ever run (X5-g), which is the leak SG-HRN-01 exists to stop.

**Primary recommendation:** Extend `features/lib/hermetic-git.ts` with typed named additions (dates, CA file, protocol, stdin input) and use it for every test-side git call. Rebuild `git-test-repository.ts` on it, keeping the exported API. Add the refusing arm through `git -c` arguments, add `GIT_SSL_CAINFO` and a stub-first `PATH` to `RpcGitEnvironment`, and add `features/lib/ssh-git-host.ts` as one module that is both the parent side and the stub. Assert every builder's exact key set in `hermetic-git-environment.test.ts`, with a grown `INHERITED_VARIABLES`. Add one behavioral leak check that runs a real clone under a planted `GIT_CONFIG_COUNT` rewrite.

## Architectural Responsibility Map

The tiers here are test-harness tiers, not web tiers. No production tier changes.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| One hermetic git environment and the git runner | `features/lib/hermetic-git.ts` (suite-wide support) | — | Locked: one builder, one key set, for unit, integration, and cucumber |
| Unit and integration fixture repositories | `test/platform/git-test-repository.ts` and test-local seeds (`warm-mirror-seed.ts`) | `features/lib/hermetic-git.ts` | Test support lives next to its concern; the env comes from the shared builder |
| Cucumber fixture repositories and clone inspection | `features/lib/{git-marketplace,git-plugin,mcp-verdict-git,git-clones}.ts` | `features/lib/hermetic-git.ts` | Already on `runGit`, except `git-clones.ts`, which parses `.git` files by hand |
| HTTPS git serving, SHA-want policy, refusing arm | `features/lib/https-git-host/{server,cgi}.ts` | `features/support/pi-process.ts` (PiRun lifecycle) | The arm is per repository, set by a step, read when the CGI starts |
| SSH transport and probe answers | NEW `features/lib/ssh-git-host.ts` (parent and stub in one module) | `features/support/pi-process.ts` | Pi fixes PATH at start, so the stand-in shares PiRun with Pi and the git host |
| Pi's environment (CA, PATH, git config) | `features/lib/pi-rpc.ts` `rpcChildEnvironment` / `RpcGitEnvironment` | `features/support/pi-process.ts`, `features/lib/real-subagent-child.ts`, `test/integration/subagent-hook-ownership.test.ts` | Every cucumber and integration Pi gets its environment from this one allowlist |
| Leak detection | `test/architecture/hermetic-git-environment.test.ts` | `test/architecture/https-git-host-*.test.ts`, NEW `test/architecture/ssh-git-host.test.ts` | SG-HRN-04 names this test; the self-checks run in `test:unpaired` |
| Git version in CI logs | `.github/workflows/ci.yml`, `e2e-nightly.yml` | — | Locked job list |
| e2e transport determinism | `package.json` e2e scripts | — | "its own run variable" |

## Standard Stack

No new dependency. The phase uses what the repository and the machine already have.

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| system `git` | 2.43.0 here [VERIFIED: `git --version`]; GitHub `ubuntu-latest` ships a newer one [ASSUMED] | fixture creation, inspection, `http-backend`, `upload-pack`, `pack-objects` | Already used by every cucumber fixture through `runGit` (`features/lib/hermetic-git.ts:35-42`) |
| `node:child_process` `execFile` / `spawn` | Node v22.23.5 here, Node 24 in CI [VERIFIED: `node --version`; `.github/workflows/ci.yml` `node-version: "24"`] | async git calls with an argument array and no shell | Locked call style |
| `openssl` | /usr/bin/openssl [VERIFIED: `which openssl`] | the git host's certificate (unchanged) | Already used by `HttpsGitHost.start` |
| `/bin/sh` | present | the generated `ssh` wrapper (`exec "<node>" "<module>" ... "$@"`) | Precedent: `features/lib/hook-files.ts:495-498` generates `#!/bin/sh` wrappers around `process.execPath` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git -c uploadpack.<key>=<value> http-backend` | `GIT_CONFIG_COUNT` / `KEY_n` / `VALUE_n` in the CGI environment | Both reach upload-pack (X3-F/H with each form). The `-c` form keeps the whole `GIT_CONFIG_*` family out of every harness environment, so the hermetic test can assert "no `GIT_CONFIG_COUNT` anywhere" without an exception for the CGI. Use `-c` |
| Config file in each bare repository | `git config uploadpack.allowReachableSHA1InWant true` at publish time | Spread over four fixture writers and survives a disarm; rejected |
| `GIT_SSH_COMMAND` stub | stub `ssh` first on PATH | Locked: PATH stub, because a set `GIT_SSH_COMMAND` is upstream's probe-skip signal |
| A `.mjs` stub | the stub as a `.ts` module run by `process.execPath` | Node strips types only for `.ts` files; an extensionless `ssh` file would not be stripped, so a generated wrapper that runs the `.ts` module through the absolute Node path is required either way. Use the `.ts` module, as `state-lock-holder.ts`, `hook-recorder.ts`, and `mcp-stub-server.ts` already do [VERIFIED: `features/lib/state-lock-holder.ts:39,65,136`; `features/lib/mcp-stub-server.ts:33,262`] |

**Installation:** none.

## Package Legitimacy Audit

This phase installs no external package. No `npm install`, no new `package.json` dependency, no lockfile change.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
 unit / integration case (node:test)            cucumber worker (BeforeAll per worker)
        |                                                 |
        v                                                 v
 git-test-repository.ts / seeds            HttpsGitHost.start(root/git-host)   SshGitHost.start(root/ssh-host)
        |                                    |  cert.pem, repositories/<owner>/   |  bin/ssh (sh exec wrapper)
        |  runGit*(cwd, home, vars)          |                                    |  arms.json, requests.jsonl
        v                                    v                                    v
  hermeticGitEnvironment(home) ---> {PATH, HOME, GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL=/dev/null, identity, +named}
        |                                    ^                                    ^
        v                                    |                                    |
   system git (fixture, inspection)          |                                    |
                                             |                                    |
 piEnvironment = {NODE_EXTRA_CA_CERTS, GIT_SSL_CAINFO=cert.pem, GIT_CONFIG_NOSYSTEM, GIT_CONFIG_GLOBAL=<sandbox>/.gitconfig,
                  PATH=<ssh-host/bin>:<PATH>, GitHub base override}
        |
        v
 rpcChildEnvironment (allowlist) --> Pi (RPC / TUI / JSON / profile / subagent child)
        |                                  |
        |  Phase 1: product = isomorphic-git (Node HTTPS, NODE_EXTRA_CA_CERTS)    Phase 3+: product = system git
        v                                  v
  https://127.0.0.1:<port>/<owner>/<repo>.git  -----> HttpsGitHost.receive
        |                                                 | arm?  status/drop/hold/credential/redirect -> answered here
        |                                                 | arm = refuse-sha-want -> CGI without GIT_PROTOCOL,
        |                                                 |       git -c uploadpack.allow*SHA1InWant=false http-backend
        |                                                 v
        |                                      git http-backend (hermetic env) -> upload-pack
  git@github.com:<owner>/<repo>.git (Phase 3+)  or  ssh -T / ssh -G (Phase 4 probe)
        |
        v
  PATH lookup "ssh" -> <ssh-host/bin>/ssh -> exec node ssh-git-host.ts <stand-in dir> "$@"
        |  parse argv; append a JSON line to requests.jsonl
        |-- git-upload-pack '<path>' to a registered host -> git upload-pack <repositories>/<path> (hermetic env + GIT_PROTOCOL)
        |-- no remote command (-T probe) -> scripted arm per host: authenticated | denied | host-key | hold
        |-- -G <destination> -> "hostname <host>" lines, or a proxy arm's line
        `-- unregistered host -> "ssh: Could not resolve hostname <host>..." exit 255
```

### Recommended Project Structure (changed and new files only)

```text
features/lib/
├── hermetic-git.ts             # MODIFIED: typed named additions, a stdin/Buffer runner variant
├── https-git-host/server.ts    # MODIFIED: refuse-sha-want arm in GitHostArm; arm reaches the CGI call
├── https-git-host/cgi.ts       # MODIFIED: cgiEnvironment drops GIT_PROTOCOL for the arm; runHttpBackend takes -c args
├── ssh-git-host.ts             # NEW: SshGitHost (start/register/arm/reset/snapshot/close) + the stub's main (argv[1] === this file)
├── git-clones.ts               # MODIFIED (inspection on system git): rev-parse / config instead of hand-parsing .git
├── pi-rpc.ts                   # MODIFIED: RpcGitEnvironment gains GIT_SSL_CAINFO and PATH
└── real-subagent-child.ts      # MODIFIED: supplies the new RpcGitEnvironment members
features/support/
└── pi-process.ts               # MODIFIED: PiRun gains sshHost; BeforeAll/Before/AfterAll and the reset snapshot
test/platform/
└── git-test-repository.ts      # REWRITTEN on system git, same exported API, plus helpers for existing directories
test/orchestrators/plugin/
└── warm-mirror-seed.ts         # REWRITTEN on system git, fixed dates
test/architecture/
├── hermetic-git-environment.test.ts  # MODIFIED: grown INHERITED_VARIABLES, every builder's exact keys, one real-clone leak check
├── https-git-host-cgi.test.ts        # MODIFIED: refusing-arm environment and argument cases
├── https-git-host-server.test.ts     # MODIFIED: system-git clone with GIT_SSL_CAINFO, SHA fetch, refusing arm, --unshallow
└── ssh-git-host.test.ts              # NEW: argv parsing table, real clone and SHA fetch through the stub, probe arms, -G, unregistered host
.github/workflows/ci.yml, e2e-nightly.yml   # MODIFIED: "git --version" step
package.json                                 # MODIFIED: CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1 on the e2e scripts
```

### Pattern 1: Named additions on the one builder

**What:** `hermeticGitEnvironment(home)` stays the eight-key base. A call that needs more passes a closed, typed object of named variables, so the key set of every call is visible in the type and in the hermetic test.
**When to use:** fixture dates, the CA file of a harness check, `GIT_PROTOCOL` for the CGI and the stub.
**Example:**

```typescript
// Source: extends features/lib/hermetic-git.ts:17-42 (the eight keys and runGit's -c pair, read verbatim below)
export interface HermeticGitVariables {
  readonly GIT_AUTHOR_DATE?: string;
  readonly GIT_COMMITTER_DATE?: string;
  readonly GIT_SSL_CAINFO?: string;
  readonly GIT_PROTOCOL?: string;
}

export function hermeticGitEnvironment(
  home: string,
  variables: HermeticGitVariables = {},
): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features",
    GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features",
    GIT_COMMITTER_EMAIL: "features@example.test",
    ...variables,
  };
}
```

The member names in the interface are [ASSUMED] design; the eight base keys are [VERIFIED: `features/lib/hermetic-git.ts:17-28`], quoted verbatim:

```text
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features",
    GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features",
    GIT_COMMITTER_EMAIL: "features@example.test",
```

and `runGit` passes `["-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args]` [VERIFIED: `features/lib/hermetic-git.ts:38`].

Identity choice: the unit builder used `Git contract <git-contract@example.invalid>` [VERIFIED: `test/platform/git-test-repository.ts:10-13`], and the shared builder uses `features <features@example.test>`. Either works, because no test pins a fixture-built object id (see Pitfall 6). Keeping the builder's own identity (and so a single identity everywhere) is the simpler key-set story. Overriding the identity through named variables keeps unit OIDs identical to today's, which is a free regression oracle during the move (X1). Recommend the single identity. If the planner wants the oracle, it can compare OIDs once in a scratch run.

### Pattern 2: The unit fixture builder on system git (proven)

**What:** `createGitTestRepository` keeps `dir`, `gitdir`, `initialOid`, `commit`, `pack`. Each repository has its own date counter, as today's `commitIndex`, and its own scratch HOME removed by `t.after`.
**Evidence:** the prototype below, placed in a scratch copy of the tree, passed `test/platform/git.test.ts` and `test/orchestrators/plugin/marketplace-tag-probe.test.ts` with no other change: `# tests 124 # pass 124 # fail 0` [VERIFIED: experiment X2].

```typescript
// Source: experiment X2 prototype (scratch copy of test/platform/git-test-repository.ts)
const run = async (...args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args],
    { cwd: dir, env: environment(home, 1_700_000_000 + commitIndex) }, // GIT_AUTHOR_DATE/GIT_COMMITTER_DATE = `${date} +0000`
  );
  return stdout.trim();
};

async function commit(files: readonly GitTestCommitFile[], message: string): Promise<string> {
  for (const file of files) {
    await mkdir(dirname(join(dir, file.filepath)), { recursive: true });
    await writeFile(join(dir, file.filepath), file.contents);
    await run("add", "--", file.filepath);
  }
  commitIndex += 1;
  await run("commit", "-q", "--allow-empty", "-m", message);
  return run("rev-parse", "HEAD");
}

async function pack(ref = "HEAD"): Promise<{ readonly oid: string; readonly packfile: Buffer }> {
  const oid = await run("rev-parse", `${ref}^{commit}`);
  // git pack-objects --stdout --revs, with "<oid>\n" on stdin: the whole closure of the commit
  const packfile = await packObjects(dir, environment(home, 0), `${oid}\n`);
  return { oid, packfile };
}
```

`test/platform/git.test.ts:309-344` wraps the packfile in a v0 `NAK` plus side-band-1 response for the isomorphic-git client [VERIFIED: read], and isomorphic-git indexes the system-git pack without complaint (same run).

### Pattern 3: Refusing arm through arguments, not environment

```typescript
// Source: experiment X3 (scratch patch of features/lib/https-git-host/cgi.ts), shape only
// default arm: GIT_PROTOCOL passed through; -c uploadpack.allowReachableSHA1InWant=true for a v0 client
// refusing arm: no GIT_PROTOCOL; -c uploadpack.allowReachableSHA1InWant=false -c uploadpack.allowAnySHA1InWant=false
spawn("git", [...configArguments, "http-backend"], { env, stdio: ["pipe", "pipe", "pipe"] });
```

Measured results with the real `HttpsGitHost` and a two-commit repository (non-tip SHA = first commit) [VERIFIED: experiment X3]:

| Case | Result |
|------|--------|
| A clone, `NODE_EXTRA_CA_CERTS` only | `FAIL(128) ... server certificate verification failed. CAfile: none CRLfile: none` |
| B clone, the sandbox's inherited environment | `FAIL(128) ... server certificate verification failed. CAfile: /root/.ccr/ca-bundle.crt` |
| C clone `--depth 1`, hermetic env + `GIT_SSL_CAINFO` | OK; requests `GET .../info/refs?service=git-upload-pack 200`, `POST .../git-upload-pack 200`, `POST .../git-upload-pack 200` |
| D `fetch --depth 1 origin <non-tip sha>`, v2 | OK `* branch <sha> -> FETCH_HEAD`; same three requests |
| E same, client `protocol.version=0`, default host | `error: Server does not allow request for unadvertised object <sha>` |
| F same, v0, `allowReachableSHA1InWant=true` (env form and `-c` form) | OK |
| G v2 with both allow keys false, `GIT_PROTOCOL` passed | OK (v2 ignores the keys) |
| H refusing arm (no `GIT_PROTOCOL`, both false; env form and `-c` form) | `error: Server does not allow request for unadvertised object <sha>`; requests: only `GET .../info/refs?service=git-upload-pack 200` |
| I full clone under the refusing arm | OK |
| J `fetch --unshallow origin` under the refusing arm | OK |
| K unknown sha, default v2 | `error: RPC failed; HTTP 500 ... fatal: expected 'acknowledgments'` (see Pitfall 5) |

### Pattern 4: One module that is both the SSH stand-in and the stub

**What:** `features/lib/ssh-git-host.ts` exports the parent class used by `pi-process.ts`, and runs as the stub when `process.argv[1]` is its own path, as `state-lock-holder.ts` does [VERIFIED: `features/lib/state-lock-holder.ts:39` `const thisFile = fileURLToPath(import.meta.url);`, `:136` `if (process.argv[1] === thisFile) {`]. Because a support module imports it, fallow sees no unused file.
**Wrapper:** `start()` writes `<dir>/bin/ssh`, mode 0o755:

```sh
#!/bin/sh
exec '<process.execPath>' '<absolute path of ssh-git-host.ts>' '<stand-in dir>' "$@"
```

The stand-in directory travels as the stub's first argument, so the stub needs no environment variable (Pi's environment stays the allowlist) and finds `arms.json` and `requests.jsonl` from it. `exec` matters: a Node `execFile(..., { timeout })` kill then reaches the stub itself; with the wrapper above, no stub process was left one 300 ms later [VERIFIED: experiment X8].
**Argv git 2.43 hands the stub** [VERIFIED: experiment X5, stub log]:

| URL / config | argv after `ssh` | `GIT_PROTOCOL` in the stub's env |
|--------------|------------------|----------------------------------|
| `git@stand-in.test:acme/tools.git` | `-o SendEnv=GIT_PROTOCOL git@stand-in.test "git-upload-pack 'acme/tools.git'"` | `version=2` |
| same, `-c "core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes"` | `-o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@stand-in.test "git-upload-pack 'acme/tools.git'"` | `version=2` |
| `ssh://git@stand-in.test:2222/acme/tools.git` | `-o SendEnv=GIT_PROTOCOL -p 2222 git@stand-in.test "git-upload-pack '/acme/tools.git'"` | `version=2` |
| client `protocol.version=0` | `git@stand-in.test "git-upload-pack 'acme/tools.git'"` | unset |
| upstream probe, run directly | `-T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` | unset |

git ran no `ssh -G` of its own in any case, and it put `GIT_EXEC_PATH` in the stub's environment, which the stub must not forward to upload-pack (build that environment from `hermeticGitEnvironment` plus `GIT_PROTOCOL` only). The scp form's path is relative (`acme/tools.git`) and the `ssh://` form's path is absolute (`/acme/tools.git`); both map to `<git host repositories>/acme/tools.git`. A stub that ran `git upload-pack --strict <repositories>/<path>` with the forwarded `GIT_PROTOCOL` served clone, `--depth 1` clone, a non-tip SHA fetch, and a v0 `ls-remote` [VERIFIED: experiment X5].

### Pattern 5: Pi's environment gains two members

`RpcGitEnvironment` today [VERIFIED: `features/lib/pi-rpc.ts:49-65`]:

```text
export interface RpcGitEnvironment {
  readonly NODE_EXTRA_CA_CERTS: string;
  readonly GIT_CONFIG_NOSYSTEM: "1";
  readonly GIT_CONFIG_GLOBAL: string;
  ...
  readonly PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL?: string;
  ...
  readonly PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS?: string;
}
```

and `rpcChildEnvironment` starts from `HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE: "1"`, `PATH: process.env.PATH ?? ""` [VERIFIED: `features/lib/pi-rpc.ts:197-202`]. Add `readonly GIT_SSL_CAINFO: string` (required, so every literal site states it) and `readonly PATH: string` (the stub directory first, built by one exported helper of `ssh-git-host.ts` from `path.delimiter`). When `git` is given, `rpcChildEnvironment` writes `git.PATH` over the default `PATH`. The member names are [ASSUMED] design.

Literal `RpcGitEnvironment` sites that must add the members [VERIFIED: grep plus read]:
- `features/support/pi-process.ts:151-156` (`piEnvironment`: `NODE_EXTRA_CA_CERTS: gitHost.certificatePath`, `GIT_CONFIG_NOSYSTEM: "1"`, `GIT_CONFIG_GLOBAL: path.join(sandbox.home, ".gitconfig")`, `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: \`https://${gitHost.address}\``). Every other cucumber Pi spreads `run.piEnvironment` (`features/support/world.ts:690,704,776,957,1253-1259`).
- `features/lib/real-subagent-child.ts:499-504` (uses `const certificates = path.join(root, "no-extra-certificates.pem")` with an empty file, `:471-472`).
- `test/integration/subagent-hook-ownership.test.ts:135-140` (same empty-file pattern, `:118-119`).
- `test/architecture/hermetic-git-environment.test.ts` (seven literal `git` objects).

### Anti-Patterns to Avoid

- **A filtered copy of `process.env`.** `{ ...process.env, HOME }` (today in `test/integration/concurrent-install.test.ts:126,131` and `load-reconcile-race.test.ts:143`, `test/e2e/upstream-marketplace.ts:43-45`) carries every sandbox variable. Build from scratch.
- **`http.sslCAInfo` in the sandbox `.gitconfig`.** An inherited `GIT_SSL_CAINFO` outranks it (E-16c, and X3-B shows the sandbox sets one), and DRV-03 requires the file to be absent until a scenario writes it.
- **A shared, module-level date counter.** `test/platform/git.test.ts:362-373` builds two repositories and asserts `assert.strictEqual(localUpdatedOid, updatedOid)`, so each repository must start its own counter at the same value.
- **`execFileSync`/`spawnSync` in support code.** It blocks the worker that also serves the git host (locked).
- **Pinning git's full stderr sentences in self-checks.** Match a stable fragment (`Server does not allow request for unadvertised object`, `successfully authenticated`) because CI's git version differs from 2.43.
- **The stub reading its configuration from an environment variable that Pi must carry.** That widens Pi's allowlist and fails the hermetic test. Pass the directory as the wrapper's fixed first argument.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A packfile for the fake HTTP transport | Walking commits and trees to collect object ids, as the isomorphic-git `pack()` did | `git pack-objects --stdout --revs` with `<oid>\n` on stdin | Proven against the real contract test (X2) |
| An SSH server | sshd, keys, known_hosts | a stub `ssh` that runs `git upload-pack` | git's SSH transport is "run `ssh <dest> <command>` and talk pkt-lines on stdio"; the stub needs no crypto (X5) |
| Serving SHA wants | A custom upload-pack | `git http-backend` / `git upload-pack` with `uploadpack.*` config | Real git semantics, including v2 ignoring the allow keys (X3-G) |
| Reading HEAD and origin of a clone | Parsing `.git/HEAD`, loose refs, and `packed-refs` by hand (`features/lib/git-clones.ts:63-92`) | `git rev-parse HEAD`, `git config --get remote.origin.url` through `runGit` | Phase 3's shallow and detached clones add `.git/shallow` and detached HEADs; git already reads them |
| Detecting a leaked variable | A per-variable `if` in each builder | Exact `deepStrictEqual` key sets under a planted `INHERITED_VARIABLES` | The existing test shape already catches any new key |

**Key insight:** the stand-ins stay real git with scripted edges. Everything that decides a wire behavior (SHA policy, protocol version, pack format) is git's own code, so Phase 3's re-baselined tables will describe what GitHub-shaped servers do.

## Fixture Migration Inventory

18 files import isomorphic-git (value imports); 19 more only mention it in comments or strings [VERIFIED: `grep -rlE '^import [^t].*from "isomorphic-git' test features` and `grep -rl isomorphic-git test features`, 37 total]. This corrects the "34 import it" note in CONTEXT.md. Classification, from each file's call sites [VERIFIED: grep of `git.<fn>` per file]:

| File | isomorphic-git use | Disposition |
|------|-------------------|-------------|
| `test/platform/git-test-repository.ts` | init, add, commit, readTree, readCommit, resolveRef, packObjects | Rewrite on system git (Pattern 2) |
| `test/orchestrators/plugin/warm-mirror-seed.ts` | init, add, commit (no timestamp, so non-deterministic today) | Rewrite with fixed dates; prototype passed its consumers (X6) |
| `test/integration/marketplace-add-seed-mirrors.test.ts` | init, add, addRemote, commit; getConfig on a product clone | Move fixture and inspection |
| `test/integration/path-source-tag-install.test.ts` | init, add (16), commit, tag, resolveRef | Move |
| `test/integration/project-install-adds-user-marketplace.test.ts` | init, addRemote; getConfig on a product clone | Move |
| `test/orchestrators/plugin/clone-cache.test.ts` | init, add, addRemote, commit, tag, resolveRef, getConfig; a symlink add (`skills/link`) | Move |
| `test/orchestrators/plugin/info.test.ts` | init, add, commit, resolveRef | Move |
| `test/orchestrators/plugin/install-cascade.test.ts` | init, add, commit, resolveRef, tag | Move |
| `test/orchestrators/plugin/install-flow-planning.test.ts` | init, add, commit, tag | Move |
| `test/orchestrators/plugin/install-outcome.test.ts` | init, add, commit, resolveRef, tag | Move |
| `test/orchestrators/plugin/list-candidate-row.test.ts` | init, add, commit, resolveRef | Move |
| `test/orchestrators/plugin/list-flow.test.ts` | init, add, commit | Move |
| `test/orchestrators/plugin/marketplace-tag-probe.test.ts` | tag (on a `createGitTestRepository` repo) | Move |
| `test/orchestrators/plugin/update-flow.test.ts` | fixtures (init, add `.`, commit, tag) **and** `t.mock.method(http, "request", ...)` on `isomorphic-git/http/node` (`:9427`) | Move the fixtures; keep the `http` import (contract) |
| `test/orchestrators/plugin/update-preflight.test.ts` | fixtures **and** `new git.Errors.HttpError(...)` (`:2427`) | Move the fixtures; keep `Errors` (contract) |
| `test/orchestrators/plugin/reinstall-flow.test.ts` | `new git.Errors.HttpError(404, ...)` (`:4893`) only | Keep (contract) |
| `test/integration/auth-e2e.test.ts` | `isomorphic-git/http/node` only | Keep (contract; Phase 3 rewrites) |
| `test/platform/git.test.ts` | contract (`Errors` instanceof, `http` mock, library oracles `listRemotes`/`getConfigAll`/`listBranches` at `:2139-2142`, `:2635-2641`) **and** fixture writes (`writeRef`, `checkout`, `addRemote`, `tag`, `annotatedTag`, `writeBlob`) | Keep the import and the contract calls; move the fixture writes (about 15 sites) so SC-1 holds literally. Phase 3 deletes most of this file, so keep the moves mechanical |

Shared helper: the inline sites mostly init a repository at a path the test already owns (a marketplace root, a mirror under `locations.pluginCloneDir(...)`), then add, commit, and tag. Put one helper beside `createGitTestRepository` in `test/platform/git-test-repository.ts` for an existing directory (init, commit-all, tag, rev-parse, config), with its own date counter, and route every inline site through it. Repeating `runGit(dir, home, "add", ...)` sequences across 15 files will trip `fallow dupes` (see Pitfall 8). The helper's name and shape are the planner's call [ASSUMED].

Cucumber helpers already on system git: `features/lib/git-marketplace.ts`, `git-plugin.ts`, `mcp-verdict-git.ts`, and the step modules `project.steps.ts`, `mcp-server/verdict-fetch.steps.ts`, `plugin/git-source.steps.ts`, `plugin/publishing.steps.ts`, `plugin/fetch.steps.ts` all call `runGit` [VERIFIED: grep]. `features/lib/git-clones.ts` inspects clones by reading files (no isomorphic-git, no git), so it moves to `runGit` inspection.

## Runtime State Inventory

The phase moves test infrastructure from one git implementation to another. It changes no product state, but it does touch runtime environments, so each category is answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. Fixtures are created per case in `mkdtemp` directories and per cucumber run under the run root; nothing persists across runs [VERIFIED: `test/platform/git-test-repository.ts:40,53`; `features/support/pi-process.ts:137`] | None |
| Live service config | None. No external service holds git config for the suites | None |
| OS-registered state | The developer's and CI runner's own git config (`/etc/gitconfig` has `filter.lfs.required=true`, `~/.gitconfig` has `commit.gpgsign=true` here, E-15) and the cloud sandbox's injected `GIT_CONFIG_COUNT=3` rows [VERIFIED: `env`] | Code edit only: from-scratch environments make them unreachable |
| Secrets/env vars | `GIT_SSL_CAINFO=/root/.ccr/ca-bundle.crt`, `HTTPS_PROXY`/`https_proxy`, `GCM_INTERACTIVE=never`, `GIT_ASKPASS=` (empty), `GIT_TERMINAL_PROMPT=0`, `GIT_EDITOR=true` in this sandbox [VERIFIED: `env`]; `GITHUB_TOKEN` used by the e2e upstream fetch (`test/e2e/upstream-marketplace.ts:42-45`) | Code edit: none may reach a suite git or Pi; the e2e upstream fetch keeps the shell environment because it needs the real network (see Open Question 2) |
| Build artifacts | `node_modules/.cache/optional-peers` (peer installs), ESLint/TS caches; none embeds git state | None |

## Common Pitfalls

### Pitfall 1: The harness works for the wrong reason (inherited trust or proxy)
**What goes wrong:** a harness check passes because the developer's shell supplies `GIT_SSL_CAINFO`, a proxy, or an insteadOf rewrite, and fails on CI or in Phase 3.
**Why it happens:** `execFile` inherits `process.env` when `env` is omitted.
**How to avoid:** every git spawn passes a from-scratch `env`. Add one self-check that plants the leaks in `process.env` (a `GIT_CONFIG_COUNT=1` rewrite `url.https://127.0.0.1:9/.insteadOf=<host url>`, a wrong `GIT_SSL_CAINFO`, a dead `HTTPS_PROXY`, `XDG_CONFIG_HOME` with a `git/ignore`) and then clones from the host through `runGit` with `GIT_SSL_CAINFO` as a named addition. It must succeed, and the host log must show the three requests. This proves success criterion 2 on any machine, not only in the cloud sandbox.
**Warning signs:** `CAfile: /root/.ccr/ca-bundle.crt` in a failure (X3-B); `could not read Username for 'https://github.com'` for an SSH URL (X5-g).

### Pitfall 2: Protocol v2 ignores the SHA-want config
**What goes wrong:** a refusing arm that only sets `uploadpack.allow*SHA1InWant=false` still serves the SHA.
**Why it happens:** v2 upload-pack accepts any want (X3-G).
**How to avoid:** the refusing arm also stops passing `GIT_PROTOCOL` to the CGI, so the backend answers v0 (X3-H).
**Warning signs:** the arm's self-check passes a fetch it should refuse.

### Pitfall 3: `XDG_CONFIG_HOME` steers git even with `GIT_CONFIG_GLOBAL=/dev/null`
**What goes wrong:** a leaked `XDG_CONFIG_HOME` with `git/ignore` hides files from `git add`.
**Evidence:** `status --porcelain` showed `?? a.txt` without it and nothing with `XDG_CONFIG_HOME` pointing at a `git/ignore` of `*.txt` [VERIFIED: experiment X7]. `core.excludesFile` and `core.attributesFile` default to `$XDG_CONFIG_HOME/git/...`, independent of the config files.
**How to avoid:** the from-scratch builder never copies it; the scratch HOME has no `.config/git/`.

### Pitfall 4: A fork's from-scratch environment drops what the test runner needs
**What goes wrong:** rebuilding `test/integration/concurrent-install.test.ts` and `load-reconcile-race.test.ts` fork environments from scratch can break the child. `scripts/isolated-pi-home.mjs` makes a new home and overrides `HOME` unless `PI_CM_TEST_HOME` is set (`if (process.env.PI_CM_TEST_HOME === undefined) {` ... `process.env.HOME = home;`) [VERIFIED: `scripts/isolated-pi-home.mjs:20-30`]. Node's test coverage of subprocesses rides on `NODE_V8_COVERAGE` [ASSUMED].
**How to avoid:** these forks run product code on isomorphic-git, not git. If the planner moves them to a builder (the locked process list includes integration children), the builder must name `PI_CM_TEST_HOME` and the coverage variable explicitly, and its keys must be asserted in the hermetic test.
**Warning signs:** a fork child that writes into a different temporary home; missing integration coverage lines.

### Pitfall 5: The git host turns an upload-pack error into HTTP 500
**What goes wrong:** for an unknown SHA, `git http-backend` exits 1 after writing a 238-byte answer that carries upload-pack's `ERR` packet. `runHttpBackend` rejects on a non-zero exit, so the host answers 500, and the client sees `error: RPC failed; HTTP 500 ... fatal: expected 'acknowledgments'` instead of GitHub's `fatal: remote error: upload-pack: not our ref <sha>` [VERIFIED: experiment X3-K; forwarding the output instead produced `fatal: remote error: upload-pack: not our ref 0123...`].
**Why it matters:** Phase 3 maps `not our ref` to `PinnedCommitMissingError` (PITFALLS.md Pitfall 5, E-2c). Today's harness cannot produce that message.
**How to avoid:** not a Phase 1 requirement. Record it for Phase 3, or let `runHttpBackend` forward a parsable answer of a backend that exited non-zero if the planner pulls it forward. Either way, check the existing scenarios for a `500` row produced by a CGI failure before changing it (Open Question 3).

### Pitfall 6: Object-id literals
**What goes wrong:** a test that pinned an isomorphic-git-built id would break.
**Evidence:** system git and isomorphic-git build identical commits from identical content, identity, date, and message (`7036b154f74669451c7437bcb6be057121c7d50e` and `5da69ef12479072814e3271bb8ecdf719ae251c5` from both) [VERIFIED: experiment X1]. No double-quoted 40-hex literal in the fixture-using files matches a fixture-built object: the only non-synthetic one, `PIN_OUTSIDE_CLOSURE` in `clone-cache.test.ts:397`, is matched by a `GitOps` fake [VERIFIED: grep plus read]. So the identity choice (Pattern 1) is free.

### Pitfall 7: Running as root, on Node 22, in this sandbox
**What goes wrong:** the sandbox shell runs as uid 0 with Node v22.23.5 first on PATH. Root reads a file in any mode, so chmod-based cases fail on the unchanged tree: `test/orchestrators/reconcile/convergence.test.ts` "T-29-22" (`# fail 1`), and `npm run check` stopped at `test:integration` with `test/integration/mcp-migration.test.ts:749` "AMIG-02" failing: `lockedLink cannot deny this process. Run this suite as a non-root user, or run node through the wrapper that scripts/init/cloud-env.sh writes on a Claude Code cloud VM.` (`tests 426, pass 425, fail 1`, after 4 m 29 s) [VERIFIED: baseline run this session; `id -u` = 0].
**How to avoid:** the repository already ships the fix. `scripts/init/cloud-env.sh` installs `/opt/pi-claude-marketplace/bin/node`, which runs `/opt/node24/bin/node` (v24.22.3, the CI version) through `setpriv --bounding-set=-dac_override,-dac_read_search`. It is installed here but not on this shell's PATH. Every gate and every executor check in this sandbox runs with `PATH="/opt/pi-claude-marketplace/bin:$PATH"`. With it, T-29-22 passes [VERIFIED: rerun this session], and see "Baseline gate result" for the full run. Put the instruction in each plan's verification step. CI runs as a normal user on Node 24 and needs nothing.

### Pitfall 8: fallow on test and feature code
**What goes wrong:** `fallow dupes` fails on any clone group, and fallow health scores the stub's argv parser. `.fallowrc.json` sets `production: { deadCode: true, health: false, dupes: false }`, so health and dupes are not limited to production code [VERIFIED: `.fallowrc.json:5-9`]. Their scope over `test/` and `features/` is inferred from that and from existing `code-duplication` markers under `test/` [ASSUMED].
**How to avoid:** route inline fixture sites through one helper; write the argv parser table-driven (a `Set` of options that take a value) to stay under cognitive 15; make the stub entry reachable by import (Pattern 4) so dead-code sees it used.

### Pitfall 9: CI's git is not 2.43
**What goes wrong:** self-checks that assert stderr wording or request counts may differ on `ubuntu-latest` [ASSUMED: newer git there].
**How to avoid:** assert exit codes, stable fragments, and request paths, not counts that depend on negotiation rounds. The CI `git --version` step makes a version-dependent failure diagnosable.

## Code Examples

### Stub argv parser (table-driven)

```typescript
// Source: experiment X5 stub, restated in the harness style; options git and upstream send
const OPTIONS_WITH_VALUE = new Set(["-o", "-p", "-l", "-i", "-F", "-J", "-b", "-c", "-D", "-E", "-e", "-I", "-L", "-m", "-O", "-Q", "-R", "-S", "-W", "-w", "-B"]);

export interface SshLaunch {
  readonly options: ReadonlyArray<readonly [string, string?]>;
  readonly printConfig: boolean; // -G
  readonly destination: string | undefined;
  readonly command: string; // "" for the -T probe
}

export function parseSshArguments(argv: readonly string[]): SshLaunch {
  const options: Array<readonly [string, string?]> = [];
  let printConfig = false;
  let index = 0;
  while (index < argv.length && argv[index]!.startsWith("-")) {
    const option = argv[index]!;
    if (OPTIONS_WITH_VALUE.has(option)) {
      options.push([option, argv[index + 1]]);
      index += 2;
    } else {
      printConfig ||= option === "-G";
      options.push([option]);
      index += 1;
    }
  }
  return { options, printConfig, destination: argv[index], command: argv.slice(index + 1).join(" ") };
}
// transport: /^git-upload-pack '(.+)'$/ on command; probe: command === "" with -T
```

Real OpenSSH also accepts an attached value (`-p2222`, `-oBatchMode=yes`). git and upstream send detached values (X5 log), so a self-check case for the attached form is optional.

### Hermetic test: grown inherited list (shape)

```typescript
// Source: test/architecture/hermetic-git-environment.test.ts:26-41 (today's list, verbatim below) plus the locked additions
const INHERITED_VARIABLES = {
  // today's rows ...
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "url.https://shell.example/.insteadOf",
  GIT_CONFIG_VALUE_0: "https://127.0.0.1:8443/",
  GIT_CONFIG_PARAMETERS: "'url.https://shell.example/.insteadof'='https://127.0.0.1:8443/'",
  GIT_SSL_CAINFO: "/shell/ca-bundle.crt",
  GIT_SSH: "/shell/bin/ssh",
  GIT_SSH_COMMAND: "ssh -i /shell/key",
  GIT_SSH_VARIANT: "ssh",
  SSH_AUTH_SOCK: "/shell/agent.sock",
  SSH_ASKPASS: "/shell/bin/ssh-askpass",
  HTTP_PROXY: "http://shell-proxy:1", http_proxy: "http://shell-proxy:1",
  HTTPS_PROXY: "http://shell-proxy:1", https_proxy: "http://shell-proxy:1",
  ALL_PROXY: "socks5://shell-proxy:1", all_proxy: "socks5://shell-proxy:1",
  NO_PROXY: "*", no_proxy: "*",
  XDG_CONFIG_HOME: "/shell/xdg",
  GIT_TRACE: "1", GIT_TRACE_PACKET: "1", GIT_TRACE2: "1", GIT_TRACE_CURL: "1",
  GCM_INTERACTIVE: "always", GCM_CREDENTIAL_STORE: "plaintext",
  CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "1",
} as const;
```

Today's rows [VERIFIED: `test/architecture/hermetic-git-environment.test.ts:26-41`], verbatim:

```text
  GIT_DIR: "/shell/repo/.git",
  GIT_INDEX_FILE: "/shell/repo/.git/index",
  GIT_CONFIG_SYSTEM: "/shell/etc/gitconfig",
  GIT_CONFIG_GLOBAL: "/shell/home/.gitconfig",
  GIT_ASKPASS: "/shell/bin/askpass",
  PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://operator.example/git",
  PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "5",
  DISABLE_UPDATES: "1",
  DISABLE_AUTOUPDATER: "true",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  FORCE_AUTOUPDATE_PLUGINS: "1",
  TMPDIR: "/shell/tmp",
  PI_SUBAGENT_CHILD: "1",
  PI_CM_HOOK_GATE: "shell-gate",
```

The planted values in the new rows are [ASSUMED] illustrations. Note: `inheritVariables` (`:44-60`) writes these into the test runner's `process.env` for the case, so a case that also spawns real git must plant only after it builds its environment, or must rely on the builder (which is the point). Optional extra rows with the same rationale: `GIT_WORK_TREE`, `GIT_OBJECT_DIRECTORY`, `GIT_EXEC_PATH`, `GIT_TEMPLATE_DIR`, `GIT_SSL_NO_VERIFY`, `GIT_ALLOW_PROTOCOL`, `GIT_CEILING_DIRECTORIES`, `LC_ALL`, `LANG` (locale changes git's stderr wording).

Builders whose exact key sets the test must assert (today: the first two; `cgiEnvironment` is asserted in `https-git-host-cgi.test.ts:149-261` against its own five planted rows):

1. `hermeticGitEnvironment(home)` and each named-addition form the suites use.
2. `rpcChildEnvironment(sandbox, git, profile)` with the new `GIT_SSL_CAINFO` and `PATH`.
3. `cgiEnvironment(request, root, home)` for the default arm and the refusing arm (no `GIT_PROTOCOL`), and the `-c` argument list for each.
4. The SSH stub's upload-pack environment (`hermeticGitEnvironment` plus `GIT_PROTOCOL` only, no `GIT_EXEC_PATH`).
5. Any fork-child builder the planner adds (Pitfall 4).

Move the shared planted list to one place both architecture tests import, or move the CGI key-set assertions into the hermetic test, so one list covers every builder. Either is local to `test/architecture/`.

### CI step

```yaml
      - name: Show the git version
        run: git --version
```

Insert it before the test step in `static` (`ci.yml:55`), `integration` (`:93`), `behavioral` (`:130`), `e2e-tests` (`:199`), `direct-coverage` (`:233`), and `e2e-nightly` (`e2e-nightly.yml:16`) [VERIFIED: job keys read]. `package` (`:264`) runs `npm pack --dry-run` and `sonarcloud` (`:185`) is a `uses:` call, so neither gets one. `lint:workflows` only checks `npm ci|install` for `--ignore-scripts` [VERIFIED: `scripts/check-workflow-install-scripts.mjs:16-18`]. The pre-commit pipeline runs yamllint `--strict`, yamlfmt, and zizmor over workflow files.

### e2e run variable

`package.json:110,114,115` define `test:coverage:e2e`, `test:e2e`, and `test:e2e:nightly`, each prefixed with `PI_CM_E2E_REF=...` [VERIFIED: read]. Prefix each with `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` as well. The assignment overrides any shell value, so the shell's value never reaches the e2e process. The in-process product (mock Pi, `test/e2e/upstream-marketplace.ts`) reads `process.env`. The RPC Pi children of e2e get `rpcChildEnvironment(sandbox)` (`test/e2e/rpc-session.ts:258`), which by the hermetic test never carries it. Phase 4 decides whether those children need it. `package.json` is a dependency file, so a commit that stages it runs every direct-coverage pair in the hook (`.agents/skills/local-verification/rules/commands.md`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unit fixtures on isomorphic-git | Unit fixtures on system git with the cucumber builder | this phase | Same object ids (X1); about 30% slower for `git.test.ts` on this machine (2.4 s to 3.1 s, measured once, under load) |
| Pi trusts the host through `NODE_EXTRA_CA_CERTS` only | plus `GIT_SSL_CAINFO` | this phase | Inert until Phase 3; required then |
| No SSH stand-in | stub `ssh` first on every cucumber Pi's PATH | this phase | Inert until Phase 3/4 |

**Deprecated/outdated:** the `isomorphic-git` fixture builders. The dependency itself stays until Phase 3/8, because production still imports it.

## Phase 3 Re-baseline Measurement

[VERIFIED: a Python scan of `features/**/*.feature` that reads each table after the step, this session]

- `Then the git host receives these requests:` occurs **79 times in 19 files**: `marketplace/hosted-source` 12, `plugin/git-source` 7, `marketplace/url-source` 7, `marketplace/device-flow` 7, `marketplace/hosted-source-update` 6, `marketplace/git-source` 6, `plugin/fetch` 5, `plugin/info` 4, `marketplace/github-source` 4, `plugin/git-source-update` 3, `plugin/bootstrap` 3, `marketplace/failed-add` 3, `marketplace/add` 3, `plugin/install-dependencies` 2, `mcp-server/verdict-fetch` 2, `marketplace/url-source-update` 2, `plugin/url-marketplace-update` 1, `plugin/autoapply` 1, `plugin/apply` 1.
- Of these, **59 tables in 17 files** hold smart-HTTP git rows (`info/refs` or `git-upload-pack`), which the transport swap changes. **20 tables** hold only hosted-catalog GETs (`marketplace/hosted-source` 11, `marketplace/hosted-source-update` 6, `marketplace/add` 2, `plugin/apply` 1), which come from Node `fetch` (`platform/hosted-manifest-fetch.ts`) and should not change.
- Other git-traffic assertions: `Then pi routes these github requests:` 7 tables in `marketplace/device-flow.feature` (in-process routing of isomorphic-git requests); two inline `requestsSince` assertions in `features/step_definitions/marketplace/background-update.steps.ts:68-70,92-101` that pin `GET /acme/ghp.git/info/refs?service=git-upload-pack` as `pending` and `dropped`; `Then the git host receives no request` 49 times (unchanged by a transport swap).
- Baselines measured under system git for the record: a clone or a `--depth 1` clone, and a v2 SHA fetch, each send `GET info/refs`, `POST git-upload-pack`, `POST git-upload-pack` (X3-C/D); a SHA fetch under the refusing arm sends only the `GET` (X3-H).

Record the 79 / 19 count, the 59 / 17 split, and the extra steps in the phase SUMMARY.md and STATE.md (locked).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitHub's `ubuntu-latest` git is newer than 2.43 | Standard Stack, Pitfall 9 | Low: only wording-sensitive self-checks care |
| A2 | `NODE_V8_COVERAGE` carries subprocess coverage for `node --test` | Pitfall 4 | Low: only integration coverage, which Sonar does not read |
| A3 | fallow health and dupes scan `test/` and `features/` | Pitfall 8 | Low: the gate run shows it at once |
| A4 | Member names `HermeticGitVariables`, `RpcGitEnvironment.PATH`, `GIT_SSL_CAINFO` required, `ssh-git-host.ts`, a `refuse-sha-want` arm kind | Patterns | None: naming is the planner's |
| A5 | Planted values in the new `INHERITED_VARIABLES` rows | Code Examples | None |
| A6 | "as GitHub does" for reachable-SHA wants on v0 (a locked decision, not re-checked here) | User Constraints | Low: only the default arm's v0 behavior |

## Open Questions

1. **Do the integration forks (`concurrent-install`, `load-reconcile-race`) get a from-scratch environment in this phase?**
   - What we know: they run product code on isomorphic-git and no git; the locked process list names "integration-test child processes"; a from-scratch env must keep `PI_CM_TEST_HOME` (Pitfall 4).
   - Recommendation: give them a small named builder asserted in the hermetic test, so the locked list holds literally. If the planner judges they start no git, record that reason in the plan instead.
2. **Does the e2e upstream checkout (`test/e2e/upstream-marketplace.ts:36-49`) stay on the inherited environment?**
   - What we know: it clones the real `github.com/anthropics/claude-plugins-official` and needs the machine's proxy and CA (this sandbox's `HTTPS_PROXY`, `GIT_SSL_CAINFO`) and `GITHUB_TOKEN`; SG-HRN-01 names the unit, integration, and cucumber suites, not e2e.
   - Recommendation: leave it inherited and say so in a comment; it is not a fixture.
3. **Forward upload-pack's error answer instead of HTTP 500 (Pitfall 5)?**
   - Recommendation: leave it for Phase 3, which owns `PinnedCommitMissingError`, and list it there. If pulled forward, first grep the feature tables for a `500` row that a CGI failure produces.
4. **Where does the SSH stand-in serve from?** It must map a path to `<git host repositories>/<owner>/<repo>.git`. `HttpsGitHost.repositories` is private today (`server.ts:347`); expose a read-only root or register per-repository paths. Planner's call.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | everything | ✓ | 2.43.0 | — |
| git http-backend / upload-pack / pack-objects | host, stub, `pack()` | ✓ | 2.43.0 | — |
| Node | stub, suites | ✓ | v22.23.5 first on PATH; v24.22.3 at `/opt/node24/bin/node`; CI Node 24 | the cloud wrapper `/opt/pi-claude-marketplace/bin/node` (Node 24) |
| openssl | host certificate | ✓ | /usr/bin/openssl | — |
| /bin/sh | stub wrapper | ✓ | — | — |
| ssh | none (the stub replaces it) | ✗ | — | the stub; absence is also Phase 4's "not configured" case |
| file modes enforced for root | chmod-based tests | ✗ in this shell (uid 0) | — | `PATH="/opt/pi-claude-marketplace/bin:$PATH"` (setpriv wrapper, Pitfall 7) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `ssh` (by design).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, architecture, integration), `@cucumber/cucumber` (behavioral) |
| Config file | `package.json` scripts; `cucumber.json` |
| Environment (this sandbox) | prefix every command with `PATH="/opt/pi-claude-marketplace/bin:$PATH"` (Pitfall 7) |
| Quick run command | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/architecture/hermetic-git-environment.test.ts test/architecture/https-git-host-server.test.ts test/architecture/https-git-host-cgi.test.ts test/architecture/ssh-git-host.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SG-HRN-01 | Unit fixture builder on system git keeps its API and contract | unit (existing consumers) | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/platform/git.test.ts test/orchestrators/plugin/marketplace-tag-probe.test.ts` | ✅ |
| SG-HRN-01 | Every moved importer still passes | unit and integration pairs | `npm run test:coverage:direct -- <path>` per moved pair; `npm run test:integration` | ✅ |
| SG-HRN-01 | No fixture builder imports isomorphic-git (only the contract files listed above) | static grep in a self-check, or a review step | `grep -rlE '^import [^t].*from "isomorphic-git' test features` equals the kept list | ❌ (optional architecture test) |
| SG-HRN-01 | A planted `GIT_CONFIG_COUNT` rewrite, wrong CA, proxy, and `XDG_CONFIG_HOME` do not reach a suite git | architecture (real clone) | quick run command | ❌ Wave 0 (new case in `hermetic-git-environment.test.ts`) |
| SG-HRN-02 | system-git clone and SHA fetch with `GIT_SSL_CAINFO` only; refusing arm fails the SHA fetch; clone and `--unshallow` still work | architecture (real host) | quick run command | ❌ new cases in `https-git-host-server.test.ts` |
| SG-HRN-02 | CGI env for the refusing arm has no `GIT_PROTOCOL`; `-c` arguments per arm | architecture | quick run command | ❌ new cases in `https-git-host-cgi.test.ts` |
| SG-HRN-03 | clone of `git@<host>:<path>` and a SHA fetch through the stub; probe arms (authenticated exit 1, denied and host-key exit 255, hold until killed), `-G` output, unregistered host exit 255; every launch logged | architecture | quick run command | ❌ new `test/architecture/ssh-git-host.test.ts` |
| SG-HRN-03 | Every cucumber Pi has the stub first on PATH; the reset finds the stand-in empty | behavioral (Before snapshot) | `npm run test:cucumber` | ❌ (new `Before()` assertion) |
| SG-HRN-04 | every builder's exact key set under the grown `INHERITED_VARIABLES` | architecture | quick run command | ✅ (extend) |
| SG-HRN-04 | `git --version` in each listed CI job | CI log (manual on the PR run) | — | manual-only: a workflow step has no local runner |
| (record) | 79 / 19 count and the 59 / 17 split | none | the scan in "Phase 3 Re-baseline Measurement" | — |

### Sampling Rate

- **Per task commit:** the pre-commit hook (`check:commit`: static checks, `test:unpaired`, staged pairs). A commit that stages `test/platform/git-test-repository.ts` or another non-`.test.ts` file under `test/`, or `package.json`, runs every pair.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree (compare against the baseline in this sandbox, Pitfall 7) before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `test/architecture/ssh-git-host.test.ts` (new): argv table and real-git cases.
- [ ] New cases in `https-git-host-server.test.ts`, `https-git-host-cgi.test.ts`, and `hermetic-git-environment.test.ts`.
- None for frameworks: `node:test` and cucumber are in place.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled. The phase adds test-only code that runs subprocesses and serves files on loopback.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (the credential arm is unchanged) |
| V3 Session Management | no | — |
| V4 Access Control | yes (stub path mapping) | resolve the requested path under the repositories root and refuse a path that leaves it (`path.resolve` plus a prefix check, or reuse `HttpsGitHost.repositoryPath`) |
| V5 Input Validation | yes | the stub parses argv with a closed option table and matches `^git-upload-pack '(.+)'$`; spawns use argument arrays, never a shell |
| V6 Cryptography | no | the host's existing openssl certificate, unchanged |
| V12 Files and Resources | yes | the wrapper is written with mode 0o755 inside the run root; single-quote the three paths it embeds and refuse a path that contains a quote |

### Known Threat Patterns for this harness

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A scenario reaches real GitHub over SSH, or uses the developer's SSH agent and keys | Information disclosure | stub always first on PATH; unregistered host exits 255; `SSH_AUTH_SOCK` never in Pi's allowlist (asserted) |
| The shell's proxy or CA reroutes loopback traffic, or a URL rewrite sends a fixture to a real host | Tampering | from-scratch environments; planted-leak self-check |
| Path traversal through `git-upload-pack '../..'` to serve a file outside the run | Information disclosure | containment check before `upload-pack` |
| Shell injection through the generated wrapper | Elevation of privilege | fixed template, quoted absolute paths, `exec`, `"$@"` |
| A held stub outlives its scenario | Denial of service | `exec` wrapper so kills reach it (X8); reset asserts no live stub (Phase 4 adds pid tracking if it arms `hold`) |

## Baseline gate result

`npm run check` on the unchanged tree (`a94582e`, `features/system-git`) in this sandbox, measured this session [VERIFIED: runs logged under the session scratchpad]:

| Run | Environment | Result |
|-----|-------------|--------|
| 1 | the sandbox shell as is (Node 22, root) | exit 1 at `test:integration`: AMIG-02 `lockedLink cannot deny this process` (root) |
| 2 | `PATH="/opt/pi-claude-marketplace/bin:$PATH"`, otherwise the full sandbox environment | `check:static` passed (typecheck 11 s, lint 148 s, lint:workflows, fallow 6 s, format:check 46 s, test:corresponding, check:features); `test:unpaired` and `test:integration` passed; `test:cucumber` adapter **2095/2100**, then the chain stopped (exit 1). All 5 failures are Glob scenarios in `features/hook/tool-use.feature` (`:296`, `:355`, `:443`, `:1696`, `:1834`): `find failed: fd is not available and could not be downloaded`. CI installs `ripgrep` and `fd-find` (`ci.yml:166-171`); here `rg` exists and `fd` does not. 12 m 12 s |
| 3 | run 2's PATH, full sandbox environment, `test:coverage:direct:all` alone | exit 1 after 13 s: `test/bridges/hooks/dispatch-exec.test.ts:39` "executes a blocking hook through the portable process boundary" (`Unexpected token '<', "<persisted"...`). The same case passes under `env -i HOME=... PATH=...` and fails with the full environment, so the sandbox's large environment pushes the hook child's printed output over the saved-output cap. This is the node test-runner leak that CONTEXT.md defers to Phase 2/3 |
| 4 | `env -i HOME="$HOME" PATH="/opt/pi-claude-marketplace/bin:$PATH" NODE_OPTIONS=--max-old-space-size=4096 TMPDIR=...` | `test:coverage:direct:all` exit 0 (376 records, 134 s); `test:cucumber:profile -- --profile builtin` 204/204 (86 s) |

What this means for the plans:

- Gates in this sandbox run through the wrapper PATH. Expect the 5 `fd` scenarios and the one dispatch-exec case to fail in the full sandbox environment before and after this phase. Record them as the baseline in each gate's notes, or install `fd` (an `apt-get install fd-find` outside the project, which needs the user's go-ahead).
- To prove success criterion 2 here and still get a clean verdict, run the gate under a trimmed environment that plants the cloud sandbox's rewrite on purpose: `env -i HOME="$HOME" PATH="/opt/pi-claude-marketplace/bin:$PATH" NODE_OPTIONS=--max-old-space-size=4096 GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com: GIT_CONFIG_KEY_1=url.https://127.0.0.1:9/.insteadOf GIT_CONFIG_VALUE_1=https://127.0.0.1 GIT_SSL_CAINFO=/root/.ccr/ca-bundle.crt npm run check`. The second rewrite sends any leaked loopback URL to a closed port, so a leak fails loudly. Leave the proxy variables out of this command: `scripts/install-test-peers.mjs` may need the registry, and the in-suite self-check covers a leaked proxy. The planted-leak self-check (Pitfall 1) proves the same thing inside the suite on any machine. The planter values are [ASSUMED] design. Whether the trimmed environment also avoids the 5 `fd` failures was not measured (the adapter profile did not run under it).

## Sources

### Primary (HIGH confidence)
- Experiments in this session (scratch copies under the session scratchpad, no repository file changed): X1 OID parity, X2 system-git `git-test-repository.ts` against `test/platform/git.test.ts` plus `marketplace-tag-probe.test.ts` (124/124), X3 the real `HttpsGitHost` with system git (A-K), X5 stub `ssh` argv and upload-pack, X6 system-git warm mirror seed against its consumers (`list-installed-row`, `list-candidate-version`, `convergence`: 150/150 on Node 24 through the cloud wrapper; X2 also 124/124 there), X7 `XDG_CONFIG_HOME`, X8 timeout kill through the `exec` wrapper.
- Source files read this session: `features/lib/hermetic-git.ts`, `features/lib/https-git-host/{cgi,server}.ts`, `features/lib/pi-rpc.ts`, `features/support/pi-process.ts`, `features/lib/real-subagent-child.ts`, `features/lib/git-clones.ts`, `features/step_definitions/git-host.steps.ts`, `features/step_definitions/marketplace/background-update.steps.ts`, `test/platform/git-test-repository.ts`, `test/platform/hermetic-environment.ts`, `test/orchestrators/plugin/warm-mirror-seed.ts`, `test/architecture/{hermetic-git-environment,https-git-host-cgi,https-git-host-server,no-shell-out}.test.ts`, `test/e2e/{upstream-marketplace,rpc-session}.ts`, `scripts/{isolated-pi-home,check-corresponding-tests,check-features,check-workflow-install-scripts}.mjs`, `.fallowrc.json`, `package.json`, `.github/workflows/{ci,e2e-nightly}.yml`, `tsconfig.json`, `cucumber.json`.
- `.planning/research/PITFALLS.md` (Pitfalls 2, 5, 9; E-2, E-2b, E-2c, E-15, E-16, E-16c), `ARCHITECTURE.md` (build order step 1, test-harness rows), `SUMMARY.md` (Phase 1).

### Secondary (MEDIUM confidence)
- `.agents/skills/{cucumber,typescript-unit-tests,local-verification}` rules (project policy, read this session).

### Tertiary (LOW confidence)
- None used for a recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new dependency; tools probed).
- Architecture: HIGH for the HTTPS arm, the stub transport, and the fixture builder (proven by experiment); MEDIUM for member naming and file placement (design).
- Pitfalls: HIGH (each but A2 and A3 reproduced).

**Research date:** 2026-11-23
**Valid until:** 2026-12-23 (stable; re-check if CI's git version or Node's type-stripping rules change)
