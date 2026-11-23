---
phase: "1"
slug: "harness-on-system-git"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-23"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| shell environment → suite processes | the developer or CI shell's git, ssh, proxy, and CA variables versus fixture git, the git host's CGI, Pi, the ssh stub, and integration children | git configuration, credentials, URL rewrites |
| stand-in hosts → system git | the loopback HTTPS git host and the stub `ssh` serve repositories to system git | repository objects, TLS trust, ssh argv |
| CI workflow files → runners | new `git --version` steps | none (static command) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | `runSystemGit` / `systemGitBytes` environment | medium | mitigate | env is only `hermeticGitEnvironment(...)` (`test/platform/git-test-repository.ts:61-67`) | closed |
| T-01-02 | Information disclosure | fixture git reading user config or credentials | medium | mitigate | `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, per-call scratch HOME | closed |
| T-01-03 | Elevation of privilege | argument injection into git | low | mitigate | `spawn` with argument arrays, no shell | closed |
| T-01-04 | Tampering | new CI workflow steps | low | mitigate | six static `run: git --version` steps, no expressions; zizmor/yamllint | closed |
| T-01-05 | Tampering | `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` in e2e | low | mitigate | script-level assignment overrides the shell (`package.json`) | closed |
| T-01-06 | Information disclosure | e2e upstream checkout keeps the shell environment | low | accept | see Accepted Risks | closed |
| T-01-07 | Tampering | clone-cache / list fixtures | medium | mitigate | checkout handle on the hermetic builder | closed |
| T-01-08 | Tampering | `readGitClones` resolving a parent repository | low | mitigate | `--git-dir=<checkout>/.git` on every call (`features/lib/git-clones.ts:51-53`) | closed |
| T-01-09 | Information disclosure | inspection git reading user config | low | mitigate | `runGit` with `hermeticGitEnvironment` | closed |
| T-01-10 | Tampering | install/info/update fixtures | medium | mitigate | checkout handle; only 5 contract files import isomorphic-git | closed |
| T-01-11 | Information disclosure | `commitAll` staging untracked files | low | mitigate | one-to-one with former `git.add(".")` sites; named paths kept | closed |
| T-01-12 | Tampering | integration fixtures | medium | mitigate | checkout handle | closed |
| T-01-13 | Information disclosure | forked children inheriting the runner environment | low | mitigate | `ipcChildEnvironment` from scratch; exact key-set test | closed |
| T-01-14 | Denial of service | child without `PI_CM_TEST_HOME` | low | mitigate | named `Error` thrown; tested | closed |
| T-01-15 | Spoofing | TLS trust of the HTTPS stand-in | high | mitigate | run's own certificate via `GIT_SSL_CAINFO`; no-CA clone fails; no `sslVerify` off anywhere | closed |
| T-01-16 | Tampering | `GIT_CONFIG_*` reaching the CGI | medium | mitigate | upload-pack settings as `-c` arguments; exact CGI key set tested | closed |
| T-01-17 | Tampering | shell `GIT_SSL_CAINFO` or PATH reaching Pi | medium | mitigate | `rpcChildEnvironment` allowlist; planted-variable key-set tests | closed |
| T-01-18 | Denial of service | refusing-arm CGI children outliving a reset | low | mitigate | same tracked `runHttpBackend` path; `killChildren()` on reset/close | closed |
| T-01-19 | Information disclosure | stand-in binding beyond loopback | low | accept | see Accepted Risks | closed |
| T-01-20 | Information disclosure | a scenario reaching real SSH, agent, or keys | high | mitigate | stub first on every cucumber Pi's PATH; unregistered host exits 255; no `GIT_SSH*` / `SSH_AUTH_SOCK` | closed |
| T-01-21 | Information disclosure | path traversal via `git-upload-pack '<path>'` | medium | mitigate | `servedRepository` refuses quotes, NUL, `..`, absolute escapes; tested | closed |
| T-01-22 | Elevation of privilege | shell injection via the generated wrapper | medium | mitigate | fixed template, `shellQuoted` refuses quotes, `exec`, argument arrays | closed |
| T-01-23 | Denial of service | held stub outliving its scenario | low | mitigate | `exec` wrapper; pid records; reset/close wait and fail naming live pids | closed |
| T-01-24 | Tampering | stub reading config from a variable Pi carries | low | mitigate | stand-in root is the wrapper's fixed argument; only `GIT_PROTOCOL` read | closed |
| T-01-25 | Information disclosure | inherited proxy/CA/credential/ssh variable reaching suite git or Pi | medium | mitigate | grown `INHERITED_VARIABLES`; exact key sets for every builder; two real clones under planted leaks | closed |
| T-01-26 | Tampering | planted variables leaking into a later case | low | mitigate | `plantVariables` saves and restores in `t.after` | closed |
| T-01-27 | Tampering | planted `GIT_DIR` writing into a real repository | low | mitigate | decoy under the case's own root; head asserted unchanged | closed |
| T-01-28 | Repudiation | STATE.md record not matching the tree | low | mitigate | read-only scan re-run by the auditor; numbers match | closed |
| T-01-SC | Tampering | npm/pip/cargo installs | high | mitigate | no dependency, lockfile, or `extensions/` change in the phase diff | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-06 | The e2e upstream checkout of the public `anthropics/claude-plugins-official` repository keeps the shell environment (including `GITHUB_TOKEN`): unchanged behavior, reaches only github.com, needs the machine's network, proxy and CA; SG-HRN-01 scopes the hermetic rule to the unit, integration and cucumber suites. Comment at `test/e2e/upstream-marketplace.ts:34-40`. | plan 01-02 (autonomous run; pending maintainer review) | 2026-11-23 |
| AR-01-02 | T-01-19 | The HTTPS git-host stand-in is a network listener: unchanged, binds `127.0.0.1` only (HOST-01), per-run self-made certificate (`server.ts:146,374`). | plan 01-06 (autonomous run; pending maintainer review) | 2026-11-23 |

---

## Notes (non-blocking)

- `test/integration/pi-subagents-child-identity.test.ts` gained `piPath: process.env.PATH ?? ""` outside any plan's `files_modified`, because `piPath` became a required `RealChildFixtureOptions` member. Those Pis serve no git host and clone nothing over SSH.
- `test/e2e/pi-runtime-smoke.ts:39` still spreads `...process.env` into a `pi --help` launch. It predates this phase and runs no install or clone.

---

## Security Audit 2026-11-23

| Metric | Count |
|--------|-------|
| Threats found | 29 |
| Closed | 29 |
| Open | 0 |

Auditor: gsd-security-auditor, ASVS L1, block_on high, tree at `f14f129`; architecture suites (hermetic, HTTPS host, CGI, SSH host) run green in the full sandbox environment.
