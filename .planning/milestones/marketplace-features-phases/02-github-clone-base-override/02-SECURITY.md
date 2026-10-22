---
phase: "2"
slug: "github-clone-base-override"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-16"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| environment -> seam | `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is user-controlled input read per network call | a URL (may hold userinfo if mis-set) |
| extension -> override host | clones, fetches, ref and tag listings go to the base | git smart-HTTP traffic, stored credentials |
| extension -> credential helper | `git credential fill` keyed by the override host | credentials |
| error -> output | the typed error and the `fetched <url>` tail reach text and json/rpc output | variable name, wire URL |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Information disclosure | `InvalidGitHubBaseUrlError` message | high | mitigate | userinfo refused (`github-base-url.ts:52`); messages built from the variable name and fixed rule text (`errors.ts:417`, class at `:431`), never the value | closed |
| T-02-02 | Tampering | clone/fetch over a cleartext base | high | mitigate | non-`https:` protocol throws before any git call (`github-base-url.ts:47`) | closed |
| T-02-03 | Spoofing | prefix match on lookalike hosts | medium | mitigate | exact `https://github.com/` prefix only (`github-base-url.ts:85`); lookalike rows in the seam test | closed |
| T-02-04 | Tampering | recorded origin drifting to the override | medium | mitigate | rewritten clone resets `remote.origin.url` to canonical (`platform/git.ts:429`); fetch passes the wire URL as an option, never writes config | closed |
| T-02-05 | Information disclosure | `fetched <wire url>` cause tail | low | accept | see AR-01 | closed |
| T-02-06 | Information disclosure | credential sent to the override host | high | mitigate | `buildGitHubAuth` binds stored credentials to the override host (`auth-host.ts:229-231`); `onAuth` host guard unchanged | closed |
| T-02-07 | Spoofing | Device Flow for the override host | high | mitigate | under the override no provider lookup runs (`auth-host.ts:230-231`); github.com and gitlab.com base rows assert stored-credential | closed |
| T-02-08 | Denial of service | invalid variable failing path/url commands | medium | mitigate | update-flow builds GitHub auth inside the github arm (`update-flow.ts:172`); path and url cases pass with an invalid value | closed |
| T-02-09 | Repudiation | catches folding the typed error into misleading rows | low | mitigate | `rethrowInvalidGitHubBaseUrl` first in each listed catch (19 references across the extension); one case per command | closed |
| T-02-10 | Denial of service | invalid variable ending a reload reconcile | medium | accept | see AR-02 | closed |
| T-02-11 | Information disclosure | rethrown error in json/rpc output | low | mitigate | slash-free message, kept unredacted; notification-command-error case pins the cause | closed |
| T-02-12 | Repudiation | update / info --fetch / reinstall / fetch folding the error | low | mitigate | same rethrow first in each listed catch; one case per command | closed |
| T-02-13 | Denial of service | invalid variable stopping a bulk command | low | accept | see AR-03 | closed |
| T-02-14 | Information disclosure (NFR-5) | bare `info` reading the variable | low | mitigate | bare info uses the fs-only presence probe; case with an invalid value asserts unchanged output and zero git calls | closed |
| T-02-15 | Tampering | a new github.com literal bypassing the override | medium | mitigate | `local/no-github-literal` (`eslint.config.js:119`, on at `:563`, off for the seam at `:572`); 7 justified per-line disables | closed |
| T-02-16 | Information disclosure | README credential example | low | accept | see AR-04 | closed |
| T-02-SC | Tampering | npm/pip/cargo installs | low | accept | see AR-05 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-05 | The wire URL is the base plus owner/repo; userinfo, query and fragment are refused, so it carries no secret; shown only when the variable is set | plan 02-01 threat model | 2026-10-16 |
| AR-02 | T-02-10 | Fail-loud configuration error by D-08; the reconcile-aborted report names the variable, the event still returns (NFR-2), and `/reload` after a fix converges (NFR-3) | plan 02-03 threat model | 2026-10-16 |
| AR-03 | T-02-13 | Fail-loud configuration error by D-08; the command names the variable and succeeds again once fixed (NFR-3) | plan 02-04 threat model | 2026-10-16 |
| AR-04 | T-02-16 | The example uses `<user>`/`<token>` placeholders stored through the git credential helper; no real secret appears | plan 02-05 threat model | 2026-10-16 |
| AR-05 | T-02-SC | No plan installs a package; isomorphic-git and the WHATWG URL parser were already in use | plans 02-01..02-05 threat models | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-16 | 17 | 17 | 0 | secure-phase orchestrator (ASVS L1 grep-depth; register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-16
