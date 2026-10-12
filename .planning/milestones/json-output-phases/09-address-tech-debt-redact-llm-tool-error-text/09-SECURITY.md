---
phase: "9"
slug: "address-tech-debt-redact-llm-tool-error-text"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-11"
---

# Phase 9 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Recorded state to tool text | Marketplace sources in state.json are typed by the user and can carry URL userinfo with a token; the loaders echo them into content lines and error messages | marketplace source URLs, loader error messages |
| Tool content to model provider and session transcript | Every content string leaves the machine with the tool result and persists in Pi's session files | LLM tool `content` text |
| LLM tool parameters to tool text | The model chooses the `marketplace` string that the not-found line echoes | the `marketplace` parameter |
| Rejected execute to Pi's generic tool-error path | Pi 0.87.1 turns a thrown error's raw message into tool text, with no extension hook in between | thrown error messages |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Information disclosure | Marketplace-list content line (`sourceLogical` of a url source) | high | mitigate | `textContent` (`edge/handlers/tools.ts:102`) applies `redactCredentials` to every content string; test "redacts the credential of a url source on its marketplace line" pins `https://***@git.example.com/o/r` | closed |
| T-09-02 | Information disclosure | Plugin-list load-failure text | high | mitigate | `loadFailure` (`tools.ts:114`) builds through `textContent`; test "redacts a credential in the load failure it reports" pins the `ftp://***@` line | closed |
| T-09-03 | Information disclosure | Throws that escape execute (marketplace-list body, `marketplaceExists`) | high | mitigate | each execute is `try { return await build...Result() } catch → loadFailure` (`tools.ts:182-184`, `542-544`); `marketplaceExists` runs inside `buildPluginListResult`; two "instead of throwing" tests resolve with the redacted error result | closed |
| T-09-04 | Information disclosure | Not-found line echoing the LLM-supplied `marketplace` parameter | low | mitigate | not-found text built through `textContent`; test "redacts a credential in the marketplace name it reports as not found" | closed |
| T-09-05 | Information disclosure | Credential shapes outside the redactor's pattern set | low | accept | see Accepted Risks Log | closed |
| T-09-06 | Information disclosure | Absolute paths in tool error text | low | accept | see Accepted Risks Log | closed |
| T-09-SC | Tampering | npm/pip/cargo installs | low | accept | see Accepted Risks Log | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-05 | PMOD-04 keeps one redactor. Tool text comes from stored sources and loader messages, where a credential sits in URL userinfo, which the redactor replaces for every scheme. Widening the pattern set is a policy change outside this phase. | plan 09-01 threat model (decisions delegated to Claude) | 2026-10-11 |
| AR-09-02 | T-09-06 | D-05: a path is not a secret; TC-9 pins the state.json path; absolute-path redaction for tool text is a deferred idea. | plan 09-01 threat model (D-05) | 2026-10-11 |
| AR-09-03 | T-09-SC | The plan installs no package, so the package-legitimacy gate does not apply. | plan 09-01 threat model | 2026-10-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-11 | 7 | 7 | 0 | /gsd-secure-phase (L1 grep-depth short-circuit: register authored at plan time, threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-11
