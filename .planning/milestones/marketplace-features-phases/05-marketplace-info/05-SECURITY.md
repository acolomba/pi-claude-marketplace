---
phase: "5"
slug: "marketplace-info"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-18"
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Stored manifest → info outcome | Schema-invalid marketplace data must remain a typed failure isolated to its scope. | Untrusted local JSON and typed failure details |
| Project/user records → result transport | Scope identity, settings and project-first ordering must survive aggregation. | Scoped marketplace metadata |
| Feature tables → assertions | Expected values must not mask missing, extra or contradictory public fields. | Test expectations and command results |
| Scenario fixtures → filesystem | Publication and description setup must remain inside scenario-owned roots. | Temporary manifests and plugin fixtures |
| Deferred remote rows → runner | URL and GitHub examples must stay network-inactive until their designated phases. | Remote source identity metadata |
| Wire result → output catalog | Documented bytes must retain qualified scope-miss reasons and failure shapes. | Public command output |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | Manifest classification | medium | mitigate | Typed `narrowProbeError` classification and mixed-validity Cucumber coverage preserve the `plugin-info` failure shape. | closed |
| T-05-02 | Spoofing | Ordered scope outcomes | medium | mitigate | Unit and Cucumber assertions compare complete project-first notification sequences. | closed |
| T-05-03 | Denial of service | Per-scope manifest read | medium | mitigate | Each scope is evaluated independently; mixed and both-failed owner cases retain all outcomes. | closed |
| T-05-04 | Information disclosure | Fixture publication and info reads | high | mitigate | Distinct scenario-owned roots, cleanup and unchanged filesystem assertions retain read-only containment. | closed |
| T-05-05 | Repudiation | Local info command | low | accept | Read-only command output is the existing user-visible evidence; no audit subsystem is added. | closed |
| T-05-06 | Elevation of privilege | Command dispatch | low | accept | No dispatch, permission or write capability changed. | closed |
| T-05-07 | Tampering | Source-aware assertion | medium | mitigate | Complete-map comparison rejects duplicate, unknown, missing and contradictory source fields. | closed |
| T-05-08 | Information disclosure | Source fixtures and remote rows | high | mitigate | Scenario roots stay contained and `@url`/`@github` rows remain runtime-excluded and binding-checked. | closed |
| T-05-09 | Spoofing | Source identity expectations | medium | mitigate | Exact path, URL, owner, repository and optional-ref assertions prevent substituted identities. | closed |
| T-05-10 | Denial of service | Fixture setup failures | low | accept | Bounded scenarios fail cleanly and existing cleanup releases resources. | closed |
| T-05-11 | Repudiation | Test evidence | low | accept | Plan summaries record commands, counts and exact tree identities. | closed |
| T-05-12 | Elevation of privilege | Description writer | medium | mitigate | `requirePublished` and `manifestPath` restrict writes to published scenario roots. | closed |
| T-05-13 | Spoofing | Scope fan-out fields | medium | mitigate | Healthy fan-out asserts independent true/false settings and complete project-first blocks. | closed |
| T-05-14 | Information disclosure | Explicit-scope miss | high | mitigate | Both directed misses assert one requested-scope failure and no other-scope fallback content. | closed |
| T-05-15 | Elevation of privilege | Scope selection | medium | mitigate | Directed-miss scenarios prove explicit selection never substitutes the other scope. | closed |
| T-05-16 | Tampering | Catalog expectations | low | mitigate | Exact 288-state catalog tests lock qualified miss reasons and mixed-result order. | closed |
| T-05-17 | Repudiation | Scope failure reporting | low | accept | Exact scoped failures remain the read-only command's evidence. | closed |
| T-05-18 | Denial of service | Behavioral setup | low | accept | Existing bounded Pi driver and scenario cleanup add no runtime service or loop. | closed |
| T-05-SC | Tampering | Dependency supply chain | high | mitigate | No dependency was installed or upgraded; package and lock files are unchanged. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-05, T-05-11, T-05-17 | Read-only command and test output provide sufficient evidence; a new audit subsystem is outside Phase 5. | Phase 5 plans | 2026-10-18 |
| AR-05-02 | T-05-06 | Phase 5 changes no dispatch, authorization, permission or write boundary. | Phase 5 plans | 2026-10-18 |
| AR-05-03 | T-05-10, T-05-18 | Existing bounded scenario execution and cleanup contain fixture failures. | Phase 5 plans | 2026-10-18 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-18 | 19 | 19 | 0 | GSD ASVS L1 artifact verification |

The plan-time register is complete, every mitigated threat has implementation or automated-test evidence, all accepted low-severity risks are recorded above, and every plan summary reports no threat flags outside its declared model. The ASVS L1 short-circuit applies because `threats_open: 0` and the register was authored at plan time.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-18
