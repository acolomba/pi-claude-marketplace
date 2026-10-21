---
phase: "9"
slug: "url-source-kind-and-https-git-stand-in"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-21"
---

# Phase 9 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| cucumber worker → loopback git host | A non-loopback bind would expose fixture repositories | Fixture git objects (test data) |
| Pi child → developer git config | `git credential fill` inherits Pi's environment | Credentials (sensitive) |
| fixture/CGI git → this repository | An inherited `GIT_DIR`/`GIT_INDEX_FILE` could write into the repo | Repository contents |
| request path → `git http-backend` | URL path becomes `PATH_INFO` under `GIT_PROJECT_ROOT` | File paths |
| unit case → test process env | Cases plant `GIT_*` in `process.env` | Environment variables |
| fixture writes → sandbox and host root | url arms write work trees and delete a bare repository | Test files |
| Pi `git credential fill` → credential stores | 401 triggers a credential lookup | Credentials (sensitive) |
| scenario credential → sandbox HOME | Plaintext `.git-credentials` | Test credential |
| typed source → JSON payload | Source may hold URL userinfo | Credentials in URLs (sensitive) |
| JSON payload → script consumers | Row `id` is a published contract | Payload shape |
| isomorphic-git error → reason token | Duck-typed error shape picks the reason | Error metadata |
| refused source forms → public network | GitHub-shaped forms could reach github.com | Network requests |
| offline verbs → git host | `list`/`info`/`remove` must not touch the network (NFR-5) | Network requests |
| local SC6 edit → committed tree | Red-proof plant must never be committed | Source code |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Information disclosure | `HttpsGitHost.start` listen address | medium | mitigate | `server.listen(0, "127.0.0.1")` — `features/lib/https-git-host/server.ts:128`, sole listener | closed |
| T-09-02 | Information disclosure | Pi child environment (`rpcChildEnvironment`) | high | mitigate | From-scratch allowlist + closed `RpcGitEnvironment` (`GIT_CONFIG_NOSYSTEM=1`) — `tests/e2e/_rpc.ts:49-53,184-194`; unit cases `tests/architecture/hermetic-git-environment.test.ts` | closed |
| T-09-03 | Tampering | `hermeticGitEnvironment`, `cgiEnvironment` | high | mitigate | From-scratch env, scratch HOME, `GIT_CONFIG_GLOBAL=/dev/null` — `features/lib/hermetic-git.ts:17-28`, `cgi.ts:46-56`; planted-`GIT_DIR` unit cases | closed |
| T-09-04 | Spoofing | TLS trust Pi ↔ host | medium | mitigate | Trust only via `NODE_EXTRA_CA_CERTS`; no verification bypass anywhere (grep) | closed |
| T-09-05 | Information disclosure | Run-time private key | medium | mitigate | Per-worker key under temp run root outside repo, removed in `AfterAll`; no tracked `.pem`; TruffleHog hook | closed |
| T-09-06 | Tampering | `PATH_INFO` under `GIT_PROJECT_ROOT` | low | accept | Loopback-only; http-backend refuses aliased paths (500) and `receive-pack` without `REMOTE_USER` (403) — probed by the auditor | closed |
| T-09-07 | Denial of service | CGI children and socket errors | medium | mitigate | Error handlers on req/res/child/stdin; children tracked and killed on reset/close; `Before()` asserts `children: 0` | closed |
| T-09-08 | Tampering | `writePublishedPluginFile`, `removePublishedSource` url arms | low | mitigate | `ownedTarget` containment + `wx`; removal deletes only the recorded bare repository | closed |
| T-09-09 | Information disclosure | `git credential fill` on a 401 | high | mitigate | `GIT_CONFIG_NOSYSTEM=1`, sandbox `GIT_CONFIG_GLOBAL` and HOME; D-11 by-hand control with positive control (`09-04-SUMMARY.md`) | closed |
| T-09-10 | Information disclosure | Request log | medium | mitigate | Log keeps method/path/status only; `authorization` compared in memory — `server.ts:115-119,211` | closed |
| T-09-11 | Tampering | `.git-credentials` in sandbox HOME | low | mitigate | `wx`, `0o600`, released per scenario; `Before()` empties sandbox | closed |
| T-09-12 | Information disclosure | `rowId` in `notification-json.ts` | high | mitigate | Id from already-redacted row name; planted-userinfo probe in `tests/architecture/no-credential-leak.test.ts` | closed |
| T-09-13 | Tampering | Published row `id` contract | medium | mitigate | Schema unchanged; single producer of `marketplaceSubject`; both rules unit-tested; CHANGELOG + `docs/json-output.md` | closed |
| T-09-14 | Repudiation | `classifyGitSourceAccessFailure` NotFoundError arm | low | mitigate | Matches `code === "NotFoundError"` only; single caller (add); transport ladder unchanged and unit-tested | closed |
| T-09-15 | Information disclosure | GitHub-shaped refused forms | medium | mitigate | Rows under `@github`, excluded by `cucumber.json` (`not @github`) | closed |
| T-09-16 | Information disclosure | "No request" assertions | medium | mitigate | Asserts `{ requests: [], connections: 0 }`; every TCP connection counted | closed |
| T-09-17 | Tampering | SC6 plant and local edit | medium | mitigate | Reverted with `git checkout --`; `git diff --quiet` verified; only intended fixes in `extensions` history | closed |
| T-09-18 | Tampering | Planted `GIT_*` in unit cases | low | mitigate | `t.after()` restore registered before the act; pure builders only | closed |
| T-09-SC | Tampering | npm/pip/cargo installs (all plans) | high | mitigate | No dependency or hook-config file changed in the phase | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Informational (not a register item):** `server.ts:414` calls `cgiEnvironment(...)` before the `try` in `answer()`, and `cgi.ts:51` runs `decodeURIComponent`; a malformed percent sequence (`/%zz`) from a hostile local process would raise an unhandled rejection in the worker. Loopback-only, never sent by Pi's git. Optional hardening: move the call inside the `try`.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-06 | Loopback-only test server; `git http-backend` refuses paths outside `GIT_PROJECT_ROOT` (aliased → 500) and refuses `receive-pack` without `REMOTE_USER` (403), verified by probe. Rationale written in `09-01-PLAN.md`. | plan threat model (09-01), confirmed by gsd-security-auditor | 2026-10-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-21 | 19 | 19 | 0 | gsd-security-auditor (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-21
