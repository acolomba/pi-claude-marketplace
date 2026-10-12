---
phase: "3"
slug: "typed-raw-surfaces"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-03"
---

# Phase 3 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| domain -> dispatch (device flow) | `domain/github-auth.ts` hands the device-flow prompt to `orchestrators/auth-host.ts`, which forwards it to `notifyDeviceFlowPrompt` | `verificationUri`, `userCode` (user-visible by design); the access token must never cross |
| model -> text sink | `formatEnvelopeArguments` / `formatRawSurface` build every notify tuple; the private `deliver` makes the only two `ctx.ui.notify` calls | user-visible text; error messages and diagnostic lines that may embed paths |
| lifecycle callbacks -> notify | `resources_discover` load-time warnings and the hook messages (rewake, Stop cap) | thrown-error text, plugin-author rewake text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | formatEnvelopeArguments, formatRawSurface, deliver (bytes and arity) | high | mitigate | D-15 arity table and envelope tuple rows (`tests/shared/notification-grammar.test.ts`); catalog diff and corpus check green | closed |
| T-03-02 | Denial of service | resources_discover load path in index.ts | high | mitigate | Helpers inside the unchanged NFR-2 try/catch (`index.ts:133-169`); `deliver` adds no catch or throw | closed |
| T-03-03 | Repudiation | Silent loss of a load-time warning, usage error, or help text | medium | mitigate | One `deliver` per helper; exact call lists pinned in `tests/shared/notification-dispatch.test.ts` | closed |
| T-03-04 | Information disclosure | reconcile-aborted cause text and plugin-path reason | medium | accept | Bytes locked by TEXT-01; `resolveRawSurface` is the single serialization site where PMOD-04 adds redaction in Phase 4 | closed (accepted) |
| T-03-05 | Repudiation | Corpus acceptance evidence | high | mitigate | Baseline touched only in the ledger commit `7f4ad29b`; corpus wrapper green | closed |
| T-03-06 | Repudiation | Stop-cap warning, diagnostic, or rewake silently suppressed | high | mitigate | `formatRawSurface` returns undefined only for zero lines or an empty summary; the cap arm has no undefined path | closed |
| T-03-07 | Tampering | Warning number drifting from the trip threshold | medium | mitigate | `settle.ts` passes `STOP_OVERRIDE_CAP` exported from `runtime.ts`, the constant the comparison uses | closed |
| T-03-08 | Information disclosure | Absolute paths in diagnostic lines | medium | mitigate | Producers keep `redactAbsolutePaths` (D-03 diff empty); text strategy joins verbatim | closed |
| T-03-09 | Information disclosure | Device-flow prompt path | high | mitigate | `DeviceFlowPrompt` has only `verificationUri`/`userCode` (with a `@ts-expect-error` negative); fields copied by name, no spread | closed |
| T-03-10 | Repudiation | AUTH-09 gate going vacuous after the rename | high | mitigate | Positive call and binding counts, mention counts, deep-compared visited list (`no-credential-leak.test.ts`) | closed |
| T-03-11 | Repudiation | Corpus re-baseline evidence | high | mitigate | Separate ledger commit verified against blob `225a5161` (2 removals, 3 additions, 3131 unchanged, 3134 total) | closed |
| T-03-12 | Elevation of privilege | Domain reaching presentation or ctx | low | mitigate | `github-auth.ts` has only a type import of `DeviceFlowPrompt`; boundary tests pass | closed |
| T-03-13 | Repudiation | AUTH-09 device-code prompt gate effectiveness | high | mitigate | 8 planted offenders reject; benign and comment near-miss copies pass | closed |
| T-03-14 | Tampering | A pre-composed string reaching notify (SC-5) | medium | mitigate | D-16 gate: pattern, placement, mention and literal clauses with 10 planted offenders | closed |
| T-03-15 | Repudiation | Sink gate going vacuous | medium | mitigate | Registry target, visited deep-compare, exact notify/deliver counts | closed |
| T-03-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency manifest changed (`package.json`/`package-lock.json` diff empty since `46946d89`) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-04 | Reconcile-aborted and plugin-path-skipped text may carry absolute paths or URL userinfo from a thrown message. TEXT-01 locks these bytes in this phase; the cause is serialized at the single `resolveRawSurface` site, where PMOD-04 adds credential redaction in Phase 4. | Plan 03-01 threat model (autonomous run) | 2026-10-03 |

Note (not a registered threat): import diagnostics (`orchestrators/import/execute.ts` messages built from `errorMessage(err)` and `postCommitWarnings`) reach `notifyDiagnostic` without `redactAbsolutePaths`. This file is unchanged by the phase and the base dispatch did no redaction either, so it is not a regression; PMOD-04 in Phase 4 is the carrier.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-03 | 16 | 16 | 0 | gsd-security-auditor (ASVS L1) |

Residual lexical limits of the source-scan gates are recorded as Info items IN-01..IN-04 in `03-REVIEW-DISPOSITION.md`; an L2/L3 audit would need to address them.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-03
