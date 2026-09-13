---
phase: "02"
slug: "containment-and-input-safety"
status: verified
# threats_open counts OPEN threats at or above workflow.security_block_on (high).
threats_open: 0
asvs_level: 1
created: "2026-09-05"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary                                         | Description                                                                  | Data Crossing                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Parsed scoped `mcp.json` → MCP bridges           | Untrusted JSON must be classified before enumeration or persistence          | Unknown `mcpServers` values and source path              |
| MCP preparation/removal → atomic write           | Malformed content must not become write-eligible                             | Validated server map and preserved foreign entries       |
| Manifest/state path text → filesystem owner root | Untrusted or persisted path material must remain under its normalized owner  | Raw path spelling and normalized filesystem path         |
| Checked path → subsequent read/write/return      | Existing symlink components must not redirect later operations               | Component metadata and intended target path              |
| Discovery aggregator → Pi lifecycle callback     | Lower-level discovery remains fail-loud while the host callback stays usable | Aggregate resource result or complete failure            |
| Skipped PATH scope → host notification API       | Host notification code may throw independently for each warning              | Warning message, severity, and completed lifecycle state |

---

## Threat Register

| Threat ID  | Category                           | Component                        | Severity | Disposition | Mitigation                                                                                                                                                  | Status |
| ---------- | ---------------------------------- | -------------------------------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-02-01    | Tampering / Denial of service      | `RawMcpDoc`, stage, unstage      | high     | mitigate    | `mcpServers` is `unknown`; one shared classifier runs in stage and unstage before enumeration or mutation, with complete malformed-value no-write tests     | closed |
| T-02-01-R  | Repudiation                        | Malformed MCP outcome            | medium   | mitigate    | `MalformedMcpServersError` carries stable path and value-kind fields; owner tests compare the complete structured error                                     | closed |
| T-02-01-SC | Tampering                          | Package supply chain             | low      | accept      | No dependency or package-manager installation was added; see AR-02-01                                                                                       | closed |
| T-02-02    | Tampering / Elevation of privilege | Lexical path containment         | high     | mitigate    | `hasLexicalTraversal` rejects raw `..` before normalization; the final implementation recognizes both Windows separators while preserving POSIX backslashes | closed |
| T-02-03    | Tampering / Elevation of privilege | Component walk                   | high     | mitigate    | `assertPathInside` performs `lstat` on every existing normalized component and refuses the first symlink before downstream I/O                              | closed |
| T-02-02-R  | Denial of service                  | Legitimate contained paths       | medium   | mitigate    | Equality, contained absolute paths, redundant dot spellings, and missing future leaves remain covered by the owner and consumer suites                      | closed |
| T-02-02-SC | Tampering                          | Package supply chain             | low      | accept      | No dependency or package-manager installation was added; see AR-02-01                                                                                       | closed |
| T-02-04    | Denial of service                  | `resources_discover` aggregation | high     | mitigate    | Only aggregation and result projection are caught at the root callback; failures return exact empty paths while the lower-level aggregator still rejects    | closed |
| T-02-05    | Repudiation / Denial of service    | Skipped-scope warning loop       | medium   | mitigate    | Each notification has its own catch, so every warning attempt survives a hostile notifier                                                                   | closed |
| T-02-04-R  | Tampering                          | Completed reconcile/PATH state   | high     | mitigate    | Reconciliation and PATH recomputation precede aggregation; the recovery test proves preserved state and a successful second call through the same callback  | closed |
| T-02-04-SC | Tampering                          | Package supply chain             | low      | accept      | No dependency or package-manager installation was added; see AR-02-01                                                                                       | closed |

_Status: open · closed · open — below high threshold (non-blocking)_

_Severity: critical > high > medium > low; only open high or critical threats count toward `threats_open`._

_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)._

### L1 evidence

- MCP boundary: `bridges/mcp/types.ts:18`, `bridges/mcp/stage.ts:93-129,245`, `bridges/mcp/unstage.ts:74`, and the malformed matrices in `tests/bridges/mcp/stage.test.ts:204-250` and `tests/bridges/mcp/unstage.test.ts:362-404`.
- Path boundary: `shared/path-safety.ts:25,67,100,123,142`; all live checked consumers still call `assertPathInside`, including plugin info, command staging, and six persisted location composers. The owner and consumer tests passed with direct 100% coverage.
- Lifecycle boundary: `index.ts:64-140` places hydration, reconciliation, PATH recomputation, independent warnings, and finally aggregate containment in order. `tests/index.test.ts:632` proves exact-path aggregate failure and same-callback recovery; `tests/index.test.ts:956` proves all warning attempts; `tests/orchestrators/discover.test.ts:180` keeps the aggregator fail-loud.
- Independent final code review reports `status: clean` with zero Critical, Warning, or Info findings in `02-REVIEW.md`.

---

## Accepted Risks Log

| Risk ID  | Threat Ref                         | Rationale                                                                                                                                                                                                                   | Accepted By                     | Date       |
| -------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| AR-02-01 | T-02-01-SC, T-02-02-SC, T-02-04-SC | Phase 2 uses only the repository's installed Node/tooling surface and adds no dependency, lockfile change, download, or package-manager installation; therefore it introduces no incremental package-supply-chain exposure. | Operator-approved Phase 2 plans | 2026-09-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By    |
| ---------- | ------------- | ------ | ---- | --------- |
| 2026-09-05 | 11            | 11     | 0    | the agent |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-05 at ASVS L1; no blocking threats remain.
