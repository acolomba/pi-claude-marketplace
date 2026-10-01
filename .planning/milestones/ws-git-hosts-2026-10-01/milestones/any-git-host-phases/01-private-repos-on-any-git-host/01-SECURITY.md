---
phase: "01"
slug: "private-repos-on-any-git-host"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-28"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. Built from the
> `<threat_model>` blocks of 01-01..01-04 (authored at plan time) and the SUMMARY threat flags
> (01-03 and 01-04: none).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Extension -> `git credential` helper | `credentialOps.fill(host)` spawns the user's helper, keyed by host (host:port) | stored username/PAT (secret) |
| Extension -> remote git host (https) | isomorphic-git smart-HTTP through the extension's own redirect-following client in `platform/git.ts` | `Authorization`/`cookie` headers (secret), repository data |
| Remote host -> redirect target | a 3xx `Location` can point at another origin | whatever headers the client chooses to forward |
| Extension -> user-visible output / debug log | `notify`, `Error.cause`, `hookDebugLog` | host names and cause text only; never credentials |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information Disclosure | `buildAuthForHost` bundle for every host | high | mitigate | Host compare in `onAuth` (`platform/git-auth-callbacks.ts:174`) replaces the two-host cap; see T-01-06 | closed |
| T-01-02 | Information Disclosure | `NO_STORED_CREDENTIAL_CAUSE` in `Error.cause` | medium | mitigate | Interpolates host only (`orchestrators/auth-host.ts:117`); `auth-host.ts` is a `no-credential-leak` target (`tests/architecture/gate-targets.ts:409`) | closed |
| T-01-03 | Spoofing | lookalike host resolving a credential | low | accept | See AR-01 | closed |
| T-01-04 | Denial of Service | helper subprocess per challenge on every host | low | accept | See AR-02 | closed |
| T-01-05 | Repudiation | negative assertion outliving its string | medium | mitigate | `add.test.ts` imports the live `NO_STORED_CREDENTIAL_CAUSE` constant (`:20`, `:3306`) | closed |
| T-01-06 | Information Disclosure | `onAuth` returning a credential for a foreign URL | high | mitigate | `requested.protocol !== "https:" \|\| requested.host !== opts.host` -> `{ cancel: true }` before any helper call (`git-auth-callbacks.ts:174-182`); proven at factory and transport (UAT tests 8, 11) | closed |
| T-01-07 | Spoofing | host differing only by port | medium | mitigate | `URL.host` on both sides, includes port; `:443` normalizes (UAT test 9) | closed |
| T-01-08 | Tampering | unparseable URL bypassing the compare | medium | mitigate | `new URL` inside the CP-10 try; throw -> logged cancel (UAT test 10) | closed |
| T-01-09 | Information Disclosure | mismatch reason reaching output/log | low | mitigate | `hookDebugLog` only, parsed `.host` values; module is a `no-credential-leak` target (`gate-targets.ts:417`) | closed |
| T-01-10 | Elevation of Privilege | `onAuthFailure` without the compare | low | accept | See AR-03 | closed |
| T-01-11 | Repudiation | realigned assertion checking only that `auth` exists | medium | mitigate | Plugin and edge suites compare the bundle `host` by value (UAT tests 12-13) | closed |
| T-01-12 | Tampering | coverage/lint gate weakened | high | mitigate | Coverage 100/100/100 at `npm run check` exit 0; `contracts.json` diff vs main is line-pin remaps from later phases only, no new exemption; exceptions/fallow config unchanged | closed |
| T-01-13 | Information Disclosure | real credential in a test fixture | low | mitigate | Fixtures use `credential-ops-fake.ts` `boundary: "memory"`; `no-credential-leak` runs in `npm run check` | closed |
| T-01-14 | Repudiation | fallow judged by glyph instead of exit code | medium | mitigate | Verify blocks echo exit codes unpiped; re-verification recorded `CHECK_EXIT=0` | closed |
| T-01-15 | Information Disclosure | redirect to another port carries `Authorization` | high | mitigate | Own redirect following, `followRedirects: false` (`platform/git.ts:219`); `authorization`/`cookie` dropped when `target.origin !== origin` (`:168`, `:199`); wire tests for info/refs and, since `a2db444e`, the upload-pack POST; live UAT tests 4 and 16 | closed |
| T-01-16 | Information Disclosure | redirect to `http:` on the same host sends cleartext credential | high | mitigate | Scheme is part of `URL.origin`; wire rows for info/refs and POST; UAT test 16 scheme variant saw `auth=none` | closed |
| T-01-17 | Spoofing | origin compare via prefix/lexical match | medium | mitigate | WHATWG `new URL(location, hop.url)` (`git.ts:231`) and `URL.origin`; relative and `:443` rows | closed |
| T-01-18 | Denial of Service | redirect loop | low | mitigate | `MAX_REDIRECTS = 10`, `too many redirects` (`git.ts:165`, `:227-228`); loop test | closed |
| T-01-19 | Information Disclosure | A -> B -> A regains the credential | low | accept | See AR-04 | closed |
| T-01-20 | Denial of Service | cross-origin target needing its own credential cannot authenticate | low | accept | See AR-05 | closed |
| T-01-21 | Denial of Service | Device Flow host token evicted by a cross-origin 401 | low | accept | See AR-06 (also review WR-01) | closed |
| T-01-SC | Tampering | package installs | low | accept | See AR-07 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-03 | `credentialFill` is strictly host-keyed with no `path=`; the host comes from the URL the user typed and the user's own helper decides what it holds. No hostname literal was added to `domain/auth-registry.ts`. | plan 01-01 threat model | 2026-09-28 |
| AR-02 | T-01-04 | `fill` is bounded by the 5 s credential timeout and runs at most once per challenge (AUTH-02); documented in the `buildAuthForHost` docstring. | plan 01-01 threat model | 2026-09-28 |
| AR-03 | T-01-10 | The credential is already sent when `onAuthFailure` runs; it only evicts and always cancels (CP-9). Asymmetry recorded in the docstring. | plan 01-02 threat model | 2026-09-28 |
| AR-04 | T-01-19 | Each hop starts from the previous hop, so a dropped header stays dropped — stricter than libcurl; worst case is a clean failure. | plan 01-04 threat model | 2026-09-28 |
| AR-05 | T-01-20 | Fails clean with `{authentication required}` and discloses nothing; isomorphic-git limit (DD-3). | plan 01-04 threat model | 2026-09-28 |
| AR-06 | T-01-21 | Pre-existing on a hostname change; Device Flow can re-mint, which is why eviction is enabled only there (AUTH-07). No disclosure — review WR-01 reproduced the credential reaching only the bound origin. | plan 01-04 threat model | 2026-09-28 |
| AR-07 | T-01-SC | No package installs or dependency changes in any plan of this phase. | plans 01-01..01-04 | 2026-09-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-28 | 22 | 22 | 0 | secure-phase orchestrator (ASVS L1 grep-depth; auditor skipped per short-circuit rule) |

## Security Audit 2026-09-28

| Metric | Count |
|--------|-------|
| Threats found | 22 |
| Closed | 22 |
| Open | 0 |

Non-blocking follow-ups carried from `01-REVIEW-DISPOSITION.md` (none is a disclosure): WR-03 (the
cross-origin scrub is a denylist of `authorization`/`cookie`), WR-04 (an empty `Location` is
treated as a same-URL redirect).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-28
