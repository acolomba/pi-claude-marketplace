---
phase: "11"
slug: "cross-marketplace-dependency-allowlist"
status: verified
# Count only open threats at or above the configured high-severity threshold.
threats_open: 0
asvs_level: 1
created: "2026-09-23"
---

# Phase 11 — Security

## Trust Boundaries

| Boundary | Data crossing | Required control |
| --- | --- | --- |
| Marketplace JSON to validated manifest | Untrusted policy field | Reject malformed present values without coercion. |
| Scope-selected manifest to command output | Policy names and marketplace identity | Keep scope identity and escape terminal control characters. |
| Root policy to dependency lookup | Permission to install a foreign plugin | Authorize each missing edge before lookup or mutation. |
| Installed records to dependency traversal | Existing installation state | Apply the installed exemption without extending traversal authority. |
| Installed declarations to reload bucket | Eligible sources for one missing plugin | Retain all eligible declarers and accept any valid grant. |
| Original declarer to missing-plugin cascade | Authorization context | Check the original edge before changing the cascade root. |
| Locked installed state to policy reads | Current installation state | Recheck installed state before policy lookup. |
| Failure object to notification and catalog | Policy root, reason, and remedies | Preserve the governing marketplace and both remedies. |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation and evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-11-01 | Tampering | `domain/manifest.ts` | high | mitigate | Compiled string-array schema and malformed-value command tests reject present invalid policy values. | closed |
| T-11-02 | Spoofing | `shared/notification-grammar.ts` | medium | mitigate | Control and bidi characters are escaped; info tests compare one-line output. | closed |
| T-11-03 | Information Disclosure | `marketplace/info.ts` | low | accept | Policy names are public marketplace metadata requested by the info command; see accepted risk R-11-01. | closed |
| T-11-04 | Spoofing | Refusal cause and root row | medium | mitigate | Full rendered-byte tests pin dependency, declarer, target, policy root, and both remedies. | closed |
| T-11-05 | Repudiation | Reason classification | low | mitigate | Closed-set membership, ordering, and compile-time completeness are tested. | closed |
| T-11-06 | Elevation of Privilege | `dependency-closure.ts` | high | mitigate | Fixed root authority and exact allowlist membership are checked before lookup; A-to-B-to-C negative controls cover transitive edges. | closed |
| T-11-07 | Tampering | `install-flow.ts` policy loading | high | mitigate | The scope-selected manifest uses the validated loader; malformed policy propagates a typed error. | closed |
| T-11-08 | Tampering | `install-cascade.ts` | high | mitigate | Denial occurs before transaction phases; tests compare state, config, and artifact trees. | closed |
| T-11-09 | Denial of Service | Installed/disabled traversal | medium | mitigate | Recorded-install exemption is separate from traversal stops; cycle and version controls remain tested. | closed |
| T-11-10 | Spoofing | `install-cascade.messaging.ts` | medium | mitigate | Composer tests distinguish immediate declarer from policy root and check both remedies. | closed |
| T-11-11 | Elevation of Privilege | Missing dependency installation | high | mitigate | Original edges are authorized before a synthetic B cascade; nested B-to-C edges use B's policy. | closed |
| T-11-12 | Elevation of Privilege | Reload bucket construction | high | mitigate | Existing eligibility exclusions run before source grouping; every eligible source is retained. | closed |
| T-11-13 | Denial of Service | Multi-source authorization | medium | mitigate | Same-marketplace precedence and OR authorization allow a later valid grant while preserving stable refusal diagnostics. | closed |
| T-11-14 | Tampering | Missing dependency transaction | high | mitigate | Installed state is rechecked under lock; refusal leaves saves, materialization, clones, and config unchanged. | closed |
| T-11-15 | Spoofing | Reload failure projection | medium | mitigate | Typed cross-marketplace reason survives reload; tests check the governing marketplace in each remedy. | closed |
| T-11-16 | Spoofing | Dependency and messaging documentation | medium | mitigate | Documentation identifies policy root, installed exception, and manual remedy; agreement tests drive the production composer. | closed |
| T-11-17 | Repudiation | Reload catalog and final evidence | medium | mitigate | Catalog tests compare runtime bytes; verification records literal gate results, including the inherited formatting failure. | closed |

All 17 unique threats from the seven plans were reviewed against the Phase 11 implementation. The security auditor found no unregistered threat flags or missing mitigation for the 16 mitigated threats.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
| --- | --- | --- | --- | --- |
| R-11-01 | T-11-03 | The info command explicitly requests marketplace policy details, and policy names are already public marketplace metadata. | Phase 11 plan disposition (`11-02-PLAN.md`) | 2026-09-23 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | --- | --- | --- | --- |
| 2026-09-23 | 17 | 17 | 0 | GSD security auditor and orchestrator |

## Sign-Off

- [x] All threats have a disposition.
- [x] The accepted risk is documented above.
- [x] `threats_open: 0` confirmed at the configured high-severity threshold.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-09-23
