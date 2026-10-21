---
phase: "10"
slug: "github-source-kind-and-suite-close"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-21"
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator environment → Pi child | An operator's `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` must not reach Pi | Environment variables |
| Pi child → github.com | A github scenario that escapes the override would reach the network | Requests (network) |
| request path → loopback git host | Arms and CGI must see the same decoded path | File paths |
| Pi `git credential` → credential stores | A 401 triggers a credential lookup and a remedy line | Credentials (sensitive) |
| scenario credential → sandbox HOME | Plaintext `.git-credentials` written by a step | Test credential |
| hostile-config control → developer machine | Planted `~/.gitconfig`, system helper, and GPG config | Credentials, signing config |
| SC5 local edit → repository | A red-proof edit to production code | Source code |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Tampering | `rpcChildEnvironment` override copy | high | mitigate | Built from scratch, override copied by name (`tests/e2e/_rpc.ts:197`); architecture case plants an operator value | closed |
| T-10-02 | Information disclosure | GitHub scenarios reaching github.com | high | mitigate | Every Pi gets the override set to the run's host (`features/support/pi-process.ts:86`); `PI_OFFLINE=1` (`tests/e2e/_rpc.ts:190`); request logs pinned | closed |
| T-10-03 | Tampering | override value shape | low | accept | Run builds `https://127.0.0.1:<port>` only; GHB-03 refuses other shapes | closed |
| T-10-04 | Denial of service | `runHttpBackend` stdin handling | medium | mitigate | Only `EPIPE` ignored (`features/lib/https-git-host/cgi.ts:147`); exit code decides; live-host case + 3 Node 24 runs | closed |
| T-10-05 | Tampering | arm lookup on the raw path | medium | mitigate | Arms match the decoded path via `servedPath` (`server.ts:169`); undecodable path answers 500; percent-encoded case | closed |
| T-10-06 | Denial of service | `BeforeAll()`/`AfterAll()` partial failure | low | mitigate | `settleInOrder` teardown; failed Pi start frees host and root (10-02 SUMMARY) | closed |
| T-10-07 | Information disclosure | live-host test server | low | mitigate | Host binds 127.0.0.1 only; temp root per case | closed |
| T-10-08 | Tampering | `parseShorthandSourceForm` `#` arm | medium | mitigate | `#` arm only when no `@` precedes it; left side through `parseOwnerRepo` (`domain/source.ts:414-437`); unit rows | closed |
| T-10-09 | Tampering | fixture branch pushes | low | accept | Fast-forward only; repositories under the run's temp root, reset per scenario | closed |
| T-10-10 | Information disclosure | the remedy cause line | high | mitigate | `NO_STORED_CREDENTIAL_CAUSE` interpolates only the host (`update.ts:392`); `no-credential-leak.test.ts` green | closed |
| T-10-11 | Spoofing | the host the remedy names | medium | mitigate | Host from the `buildGitHubAuth` bundle; scenarios pin `host={git host}`, unit pins `mirror.example:8443`; unset override unchanged | closed |
| T-10-12 | Information disclosure | the scenario credential | high | mitigate | Written to sandbox HOME with `flag: "wx", mode: 0o600` (`git-host.steps.ts:68`); hermetic git env | closed |
| T-10-13 | Tampering | the SC5 local edit | medium | mitigate | Restored with `git checkout --`; `git diff --name-only 3bc84b58 -- extensions` names only `domain/source.ts` and `orchestrators/marketplace/update.ts` | closed |
| T-10-14 | Information disclosure | github rows in every run | medium | mitigate | Override on every Pi (T-10-02); exact or empty request logs | closed |
| T-10-15 | Repudiation | review fixes that loosen a scenario | medium | mitigate | 10-06 added steps only (3952 → 4005 steps, 429 scenarios unchanged); extensions diff as T-10-13 | closed |
| T-10-16 | Information disclosure | the hostile control | high | mitigate | Planted files only under the scratchpad, reached via env vars; removed; marker absent; no gpg daemon left | closed |
| T-10-17 | Tampering | committing the control | medium | mitigate | Only `.planning/` paths staged; `git status` clean | closed |
| T-10-18 | Information disclosure | pushing the branch | low | mitigate | Nothing pushed (branch 636 commits ahead of `origin`) | closed |
| T-10-SC | Tampering | npm/pip/cargo installs | high | mitigate | `git diff --name-only 3bc84b58 -- package.json package-lock.json` is empty; Node 24 from npx cache | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-03 | The run controls the override value; GHB-03 already refuses userinfo, query, or fragment | plan 10-01 threat model | 2026-10-21 |
| AR-10-02 | T-10-09 | Fixture pushes stay in a per-run temporary root and are fast-forward only | plan 10-03 threat model | 2026-10-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-21 | 19 | 19 | 0 | orchestrator (L1 grep depth, register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-21
