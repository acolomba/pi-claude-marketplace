---
phase: "6"
slug: "marketplace-update-and-c-10-fix"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Recorded source → refresh | A path-source refresh must read the exact recorded manifest and never search for a replacement. | Local manifest bytes and recorded paths |
| Validated manifest → saved baseline | Only a validated, complete parse may become the comparison baseline, saved atomically with the state. | Parsed manifest JSON |
| Locked marketplace state → plugin cascade | The marketplace transaction must save and release before sequential plugin updates take their own locks. | Installed plugin names and outcomes |
| Feature tables → assertions | Expected values must compare every envelope and row; only the known rowless notice may pass the rows step. | Test expectations and command results |
| Scenario fixtures → filesystem | Publication, MCP and deletion helpers must stay inside scenario-owned roots. | Temporary manifests, plugin files and MCP config |
| Requested scope → miss reporting | A scoped miss must report the requested scope and exact name without rendering the other scope. | Marketplace names and scope markers |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Tampering | update.ts local manifest selection | high | mitigate | A path source reads only `record.manifestPath` (`update.ts:408-409`); root repair runs only for git sources; read failures rethrow with no fallback search. Decoy scenario proves it. | closed |
| T-06-02 | Tampering | manifest.ts and lastSuccessfulManifest | high | mitigate | The complete parse is captured before normalization (`manifest.ts:133`), validated before return, and saved once inside the state lock through `atomicWriteJson`. | closed |
| T-06-03 | Elevation of privilege | add.ts resolved paths and plugin roots | high | mitigate | The input resolves once against `cwd` (`add.ts:1210`) and persists as `addedFromCwd`; plugin-root containment (`plugin-resolver.ts:242`) is unchanged. | closed |
| T-06-04 | Tampering | snapshotAfterRefresh | medium | mitigate | Fresh locked load, one save after refresh, cascade after release, concurrent-removal branch kept (`update.ts:459-478`). | closed |
| T-06-05 | Information disclosure | behavioral fixtures and info | medium | mitigate | Sandbox HOME per scenario with teardown, run tokens in payloads, `info.ts` output only through `notify()`. | closed |
| T-06-06 | Tampering | semantic comparison | medium | mitigate | Raw parse keeps unknown fields and array order; `isDeepStrictEqual` ignores object key order (`update.ts:416-418`). | closed |
| T-06-07 | Tampering | invalid or absent source | high | mitigate | Any refresh failure becomes `MarketplaceUpdateError` before save; the failure path returns before the cascade (`update.ts:425-434`, `:650-678`). | closed |
| T-06-08 | Elevation of privilege | removePublishedSource (fixture) | high | mitigate | Deletes only `published.root` or `published.manifestPath`, checked by `ownedTarget`; roots proven fresh by `requireFreeRoot`. | closed |
| T-06-09 | Repudiation | update.feature assertions | medium | mitigate | Every rows-step scenario in `update.feature` also compares the whole envelope; row guards retained. | closed |
| T-06-10 | Tampering | installed target selection | high | mitigate | Targets come only from `Object.keys(record.plugins)` (`update.ts:481`); new-offer and dropped-plugin scenarios pin full inventories. | closed |
| T-06-11 | Repudiation | plugin cascade output | medium | mitigate | Per-plugin catch and continue; primary row stays `updated`; installed order kept (`update.ts:499-543`, `:794-805`). | closed |
| T-06-12 | Denial of service | marketplace/plugin lock nesting | medium | mitigate | The marketplace transaction releases (`update.ts:649`) before sequential plugin updates (`:714`). | closed |
| T-06-13 | Tampering | failed plugin update | high | mitigate | Plugin orchestrators unchanged; the failure scenario shows zeta stays at 1.0.0 in `list` and a new session. | closed |
| T-06-14 | Repudiation | command.steps.ts result comparison | high | mitigate | Only `mcp-config-notices` is rowless (`command.steps.ts:173-181`); every other non-cascade fails; both notice scenarios also compare every envelope. | closed |
| T-06-15 | Tampering | MCP fixture/config staging | medium | mitigate | Nonexistent command, `wx` writes, `ownedTarget` path check, sandbox scope root, no spawn. | closed |
| T-06-16 | Denial of service | updateAllMarketplaces | medium | mitigate | Sequential refresh; an ordinary failure becomes a failed row and the loop continues; invalid-GitHub-base rethrow kept. | closed |
| T-06-17 | Information disclosure | requested-scope miss | medium | mitigate | The other-scope probe returns only a boolean; the payload carries the requested scope and exact name (Unicode scenario). | closed |
| T-06-SC | Tampering | package installation | high | mitigate | `package.json` and `package-lock.json` are unchanged over the phase. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks. Every threat has disposition `mitigate`.

### Residual gaps (not missing mitigations)

These were raised by the phase code review (`06-REVIEW.md`). The auditor judged each a separate quality issue, not a missing declared mitigation. They remain open in `06-REVIEW-DISPOSITION.md`.

- **WR-01** (beside T-06-02/T-06-07): a hand-corrupted `lastSuccessfulManifest` fails closed but reports `{network unreachable}` instead of `{unreadable}`, and does not self-recover.
- **WR-02** (beside T-06-01): legacy records stored before this phase (relative paths, or records the C-10 bug already repointed to a decoy) are not repaired, so `info` and `update` can name different files.
- **WR-08** (beside T-06-08): `ownedTarget` accepts the published root's parent; no current deletion caller can reach it.
- **WR-09** (beside T-06-14): `file-source-update.feature` "A repeated external manifest update is up to date" uses the rows step without an envelope comparison. Production cannot emit a notice on that path today. If whole-envelope comparison must hold suite-wide, this scenario reopens T-06-14.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 18 | 18 | 0 | gsd-security-auditor, ASVS L1 mitigation verification |

The plan-time register is complete, every mitigated threat has implementation or automated-test evidence, and every plan summary reports no threat flags outside its declared threat model.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19
