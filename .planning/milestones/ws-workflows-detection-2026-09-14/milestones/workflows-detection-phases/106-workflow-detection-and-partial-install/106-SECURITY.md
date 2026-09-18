---
phase: 106
slug: workflow-detection-and-partial-install
status: verified
threats_open: 0
asvs_level: 1
register_authored_at_plan_time: true
created: 2026-08-29
---

# Phase 106 - Security

> Threat verification for workflow detection and partial installation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Plugin root to resolver | An untrusted plugin controls manifest values and files below its root. | Manifest values and file metadata |
| Resolver to install ledger | A soft unsupported signal must not bypass structural validation. | Typed resolution state and plugin root |
| Plugin source to staging targets | Workflow files sit beside supported component sources. | Supported file content and source paths |
| Ledger rollback to state | An interrupted install must leave no artifact or ghost record. | Staged artifacts and installation state |
| Resolver reason to terminal output | One typed kind becomes user-visible text on many command surfaces. | Status, reason, and hint text |
| Renderer to catalog | Executable fixtures must match the documented bytes. | Terminal output bytes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-106-01 | Tampering | Plugin schemas and resolver collector | high | mitigate | The schemas keep workflow values opaque. The resolver checks only the fixed `workflows/` directory. Manifest and resolver tests verify this boundary. | closed |
| T-106-02 | Elevation of privilege | Install ledger, bridges, and reload | high | mitigate | No workflow reader, bridge, ledger phase, resource field, discovery field, or executor exists. Sentinel tests verify every target. | closed |
| T-106-03 | Tampering | Resolution and install gates | high | mitigate | Structural failure runs before unsupported-kind handling. Strict, loose, and install tests verify the precedence. | closed |
| T-106-04 | Tampering | Install record and resource inventory | high | mitigate | Workflows persist only in `compatibility.unsupported`. The resource object keeps its five existing keys. | closed |
| T-106-05 | Repudiation | Reason classifier and command surfaces | medium | mitigate | One shared classifier maps the typed kind. Dedupe, order, parity, and exact-output tests pass. | closed |
| T-106-06 | Denial of service | Concurrent schema and resolver reads | low | accept | The reads have no shared mutable state. Deterministic concurrency tests document the bounded residual risk. | closed |
| T-106-07 | Denial of service | Install retry after interruption | medium | mitigate | A real staging failure rolls back. The same install succeeds after the fixture blocker is removed. | closed |
| T-106-08 | Spoofing | Terminal status and reason grammar | medium | mitigate | Closed statuses remain unchanged. Bidirectional catalog tests bind inventory, rejection, and success bytes. | closed |
| T-106-09 | Tampering | Closed-set tuple maintenance | low | accept | Exact-length, type-coverage, and compatibility locks make tuple drift visible. | closed |

*Only open threats at or above the configured `high` threshold count in `threats_open`.*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-106-01 | T-106-06 | Read-only concurrency has no shared mutation. The deterministic test covers the practical failure mode. | Project plan | 2026-08-29 |
| R-106-02 | T-106-09 | Existing closed-set locks detect accidental tuple drift without a new runtime control. | Project plan | 2026-08-29 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-29 | 9 | 9 | 0 | GSD security enforcement, ASVS level 1 |

---

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are in the Accepted Risks Log.
- [x] `threats_open: 0` is confirmed.
- [x] `status: verified` is set in frontmatter.

**Approval:** Verified 2026-08-29.
