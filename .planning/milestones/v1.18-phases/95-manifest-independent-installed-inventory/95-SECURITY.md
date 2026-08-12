---
phase: 95
slug: manifest-independent-installed-inventory
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-08
---

# Phase 95 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| marketplace clone → orchestrator | Remote-authored `marketplace.json` parsed by the soft loader; its plugin-name set influences a rendered claim | Manifest plugin-name set (untrusted remote content) |
| `state.json` → orchestrator | Installation records written by the install ledger, user-editable on disk | Local installation records |
| orchestrator → terminal | Rendered rows via `ctx.ui.notify` (IL-2, sole channel) | Row text (closed reason set) |
| orchestrator row → LLM tool payload | `pluginReasons` projection reaches a model's context without human review | Typed `ContentReason` array only |

No network boundary crossed (`list` offline by NFR-5, gate-enforced); no
persistence boundary crossed (the phase writes nothing).

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-95-01 | Information disclosure | `list.ts` row builder → rendered row | low | mitigate | Literal closed-set member `"not in manifest"` only; `composeReasons` accepts `Reason` members; `notify-closed-set-locks` gate | closed |
| T-95-02 | Tampering | remote `marketplace.json` → list classification | low | mitigate | Absence claim gated on a successful load with no entry (BOUND-03 / D-95-05; strengthened by the `ManifestLookup` discriminated union in the fix loop — the `unverified` arm can never claim absence) | closed |
| T-95-03 | Denial of service | `loadPluginListPayload` manifest fan-out | low | accept | No new read or allocation of consequence | closed |
| T-95-04 | Elevation of privilege | `persistence/locations.ts` path derivation | low | accept | No new path derived, no write; `assertPathInside` chokepoint (NFR-10) untouched | closed |
| T-95-05 | Information disclosure | `tools.ts::pluginReasons` → tool payload | low | mitigate | Only closed-set `ContentReason` members forwarded verbatim; undefined guard on the optional arm; closed-set gate | closed |
| T-95-06 | Spoofing | agent consuming the widened payload | low | accept | Advisory read-only field; no action or permission gated on it; `projectRowStatus` unchanged | closed |
| T-95-07 | Tampering | remote `marketplace.json` → agent-visible claim | low | mitigate | Same BOUND-03 gate as the rendered surface | closed |
| T-95-SC | Tampering | npm / pip / cargo installs | low | accept | No package-manager install task in either plan; Package Legitimacy Audit records "Not applicable", zero `[SLOP]`/`[SUS]` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-95-01 | T-95-03 | Fold path already awaited the same manifest load; binding a second field of the same result adds no fan-out | plan-time register (95-01-PLAN.md) | 2026-08-08 |
| R-95-02 | T-95-04 | Canon NFR-10 control untouched and gate-enforced elsewhere | plan-time register (95-01-PLAN.md) | 2026-08-08 |
| R-95-03 | T-95-06 | Reasons field is advisory; additive widening leaves status handling unchanged | plan-time register (95-02-PLAN.md) | 2026-08-08 |
| R-95-04 | T-95-SC | No external package installed by this phase | plan-time register (both plans) | 2026-08-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-08 | 8 | 8 | 0 | gsd-secure-phase (autonomous, State B short-circuit: plan-time register, ASVS L1, threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-08
