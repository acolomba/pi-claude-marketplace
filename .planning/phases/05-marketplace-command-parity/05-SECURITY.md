---
phase: "5"
slug: "marketplace-command-parity"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-28"
---

# Phase 5 — Security

Audit scope: the nine PLAN-authored threat models, current decisions, SUMMARY Threat Flags, and integrated implementation at `b49106b3b846ee13847d89eec8479bd40366f5c7`. Implementation and test inputs are unchanged from `3a8c7e1c6b9af4e0f7c1646e67da622829eb525e`.

Configuration: ASVS L1; block_on high.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Command text → router | Alias selection must preserve the existing command route and flags. | Commands, arguments, command identity |
| Source string or stored source → parser | Sources determine catalog fetch, git clone, or local read behavior. | URLs, source kinds, persisted raw values |
| Remote catalog → network client | Servers control redirects, response size, timing, and catalog bytes. | URLs, HTTP responses, downloaded bytes |
| Manifest → marketplace identity | Catalog names become trusted record names. | Reserved names and source authorization |
| Staging tree → persisted marketplace | Validated content is placed under the scope and recorded atomically. | Catalog files, ownership markers, state records |
| Removal outcome → persisted resources | Partial removal must subtract every artifact actually dropped. | Resource names across all six axes |
| Notification model → JSON payload | Stable IDs must not expose credentials or internal markers. | Names, IDs, diagnostic text |
| Test process → HTTPS stand-in | Only scenario-registered bytes are served on loopback. | In-memory fixture files |

## Threat Register

Paths beginning with `domain/`, `edge/`, `orchestrators/`, `persistence/`, `platform/`, `shared/`, or `transaction/` are relative to `extensions/pi-claude-marketplace/`.

| Threat Ref | Category | Severity | Disposition | Status | Evidence |
|------------|----------|----------|-------------|--------|----------|
| 05-01 / T-05-01 | Elevation of privilege | low | mitigate | closed | `edge/router.ts:282` stacks market and marketplace on `selectMarketplaceRoute`; `test/edge/router.test.ts:309` exercises both spellings through the dispatch table. |
| 05-01 / T-05-SC | Tampering | low | accept | closed | AR-05-01. |
| 05-02 / T-05-02 | Tampering | low | mitigate | closed | `orchestrators/plugin/shared.ts:1627` maps every dropped axis with a compile-checked Record; `marketplace/remove.ts:447` calls the shared fold. `test/orchestrators/marketplace/remove.test.ts:1504` verifies all six persisted axes. |
| 05-02 / T-05-SC | Tampering | low | accept | closed | AR-05-02. |
| 05-03 / T-05-03 | Spoofing | medium | mitigate | closed | `domain/source.ts:416` excludes github.com from hosted classification and validates catalog URLs; `:203` keeps manifest URL objects on the URL-only gate. `test/domain/source.test.ts:461,613,624` covers URL objects, GitHub, and HTTP refusal. |
| 05-03 / T-05-04 | Tampering | medium | mitigate | closed | `persistence/state-io.ts:372,416` reparses stored hosted records and refuses another kind. The invalid-hosted-source test at `test/persistence/state-io.test.ts:1067` covers git masquerading as hosted; `:1573` covers round-trip persistence. |
| 05-03 / T-05-SC | Tampering | low | accept | closed | AR-05-03. |
| 05-04 / T-05-05 | Spoofing | high | mitigate | closed | `domain/name.ts:98` checks the reserved set case-insensitively and exempts only github/anthropics. `orchestrators/marketplace/add.ts:488,505` runs the shared refusal before final placement/state mutation. `test/domain/name.test.ts:265,292,317` covers refusal and authorization. |
| 05-04 / T-05-06 | Spoofing | medium | accept | closed | AR-05-04 records the original D-PL5-03 acceptance and its supersession by D-PL5-28. Current broader controls are present in `domain/name.ts:127,150,395`; `test/domain/name.test.ts:355,400,415,482` covers look-alikes and own names. |
| 05-04 / T-05-SC | Tampering | low | accept | closed | AR-05-05. |
| 05-05 / T-05-07 | Information disclosure | low | mitigate | closed | `features/lib/https-git-host/server.ts:141` binds loopback; `:388,598` serves registered in-memory bytes; `:515` clears them. `features/support/pi-process.ts:127,139` resets and asserts an empty snapshot, including files. |
| 05-05 / T-05-SC | Tampering | low | accept | closed | AR-05-06. |
| 05-06 / T-05-08 | Tampering | medium | mitigate | closed | `orchestrators/marketplace/add.ts:513` refuses a repair name mismatch before placement; `:1760,1779,1792,1803` validates, contains, renames, and preserves the previous record's source/plugins. `:1139,1164` unwinds failed persistence. Tests at `test/orchestrators/marketplace/add.test.ts:3960,4028,4059,6715` cover preservation, mismatch, rollback, and hosted repair. |
| 05-06 / T-05-09 | Information disclosure | low | mitigate | closed | `orchestrators/marketplace/add.ts:413` uses the shared errno mapping; `marketplace/shared.ts:877` maps EISDIR/EIO/EBADF to unreadable. `test/orchestrators/marketplace/add.test.ts:6053` verifies closed-set rendered outcomes. |
| 05-06 / T-05-SC | Tampering | low | accept | closed | AR-05-07. |
| 05-07 / T-05-10 | Information disclosure / SSRF | high | mitigate | closed | `platform/hosted-manifest-fetch.ts:66,113,129,179` applies the complete IPv4 refusal predicate to dotted addresses and all four supported IPv4-in-IPv6 prefixes, including the three explicit metadata addresses, while retaining manual redirects, HTTPS checks, and the five-hop cap. `test/platform/hosted-manifest-fetch.test.ts:186,210,258,271` covers all 15 metadata forms, public positive controls, and redirect limits. Independent mocked-request checks passed. D-PL5-31 remains the accepted DNS residual, AR-05-11. |
| 05-07 / T-05-11 | Denial of service | medium | mitigate | closed | `platform/hosted-manifest-fetch.ts:18,19,225,294` sets the 5 MiB cap and single 10-second signal, checking declared and streamed length. `test/platform/hosted-manifest-fetch.test.ts:319,338,350,397` covers caps, cancellation, and timeout classification. |
| 05-07 / T-05-12 | Information disclosure | high | mitigate | closed | `platform/hosted-manifest-fetch.ts:180` sends only redirect/signal options; `:154,159,194,276` refuses and masks initial/redirect userinfo. `test/platform/hosted-manifest-fetch.test.ts:78,227,443` and `test/architecture/no-credential-leak.test.ts:446` verify request and credential behavior. `test/orchestrators/marketplace/add.test.ts:6651` covers the masked failure presentation. |
| 05-07 / T-05-13 | Tampering | medium | mitigate | closed | `orchestrators/marketplace/add.ts:1749,1760,1779,1792` stages, validates, checks the destination, and atomically places the catalog. `marketplace/hosted-catalog.ts:153` recognizes only matching owned leftovers and rejects a .git tree. `persistence/locations.ts:333,355` applies containment. `test/orchestrators/marketplace/hosted-catalog.test.ts:179,197` covers foreign leftovers. |
| 05-07 / T-05-14 | Spoofing | medium | mitigate | closed | Hosted requests use unmodified global fetch at `platform/hosted-manifest-fetch.ts:180`; no TLS-verification override was found in extension, feature, or script sources. `features/support/pi-process.ts:88` trusts the test host through NODE_EXTRA_CA_CERTS. |
| 05-07 / T-05-15 | Elevation of privilege | medium | mitigate | closed | `rule-packs/architecture.json:165` permits fetch only in the two sanctioned modules. `eslint.config.js:95,98,549` restricts hosted port identifiers plus static, dynamic, and type imports outside NETWORK_SEAMS, including the WR-04 correction. |
| 05-07 / T-05-16 | Spoofing | high | mitigate | closed | Shared add validation at `orchestrators/marketplace/add.ts:505,1760` applies to hosted catalogs; `domain/name.ts:106` exempts only github/anthropics. `test/orchestrators/marketplace/add.test.ts:6767` proves hosted refusal and cleanup. |
| 05-07 / T-05-SC | Tampering | low | accept | closed | AR-05-08. |
| 05-08 / T-05-17 | Information disclosure | low | mitigate | closed | `shared/notification-present.ts:203,222` redacts successful MarketplaceInfo names for path/github/url sources, URL credentials, and PluginInfo names/notes before individual or cascade output. It preserves fields and marketplaceSubject, avoids mutation, and retains original identity only when no redaction occurs. Owner evidence: `test/shared/notification-present.test.ts:613,643,663,703,758,782,802`; real presentation-to-wire evidence: `test/shared/notification-json.test.ts:1921,1948,2107`. `features/marketplace/info.feature:147,163` covers healthy and invalid manifests through the real command. Independent frozen-input and bare/qualified-ID checks passed. |
| 05-08 / T-05-SC | Tampering | low | accept | closed | AR-05-09. |
| 05-09 / T-05-18 | Tampering | medium | mitigate | closed | `orchestrators/marketplace/hosted-catalog.ts:85` checks destination containment before fetching, validates staged bytes and reserved names, then renames. `test/orchestrators/marketplace/hosted-catalog.test.ts:355,380,401,431,488` covers preservation and containment; `test/orchestrators/marketplace/update.test.ts:6104,6254` verifies stored catalog/state preservation. |
| 05-09 / T-05-19 | Tampering | low | mitigate | closed | `orchestrators/marketplace/remove.ts:1159` removes only marketplaceDataDir and the managed sourceCloneDir. `persistence/locations.ts:324,333` applies safe-name and containment checks. Partial removal keeps the footprint; source-kind selection includes hosted. |
| 05-09 / T-05-20 | Denial of service | low | mitigate | closed | `orchestrators/marketplace/update.ts:570` uses refreshHostedCatalog; `marketplace/hosted-catalog.ts:36,97` uses the same platform fetch as add, retaining its cap, timeout, and redirect policy. |
| 05-09 / T-05-SC | Tampering | low | accept | closed | AR-05-10. |

The register preserves all 29 authored rows: 19 mitigate and 10 accept, with 21 distinct IDs. T-05-SC appears once for each plan.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | 05-01 / T-05-SC | This plan introduces no package installation. | 05-01-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-02 | 05-02 / T-05-SC | This plan introduces no package installation. | 05-02-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-03 | 05-03 / T-05-SC | This plan introduces no package installation. | 05-03-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-04 | 05-04 / T-05-06 | Preserve the authored acceptance and its history: D-PL5-03 originally deferred broader name rules to MKTNAME-01. D-PL5-28 supersedes that blanket deferral and implements look-alike, spelling, own-name, prefix, and recorded-name protections. Only the exceptions expressly listed in D-PL5-28 remain; this entry does not reaccept the superseded blanket deferral. | D-PL5-03 and 05-04-SUMMARY.md backlog disposition, amended by user decision 5.2 / D-PL5-28 in 05-CONTEXT.md | 2026-10-27 |
| AR-05-05 | 05-04 / T-05-SC | This plan introduces no package installation. | 05-04-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-06 | 05-05 / T-05-SC | This plan introduces no package installation. | 05-05-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-07 | 05-06 / T-05-SC | This plan introduces no package installation. | 05-06-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-08 | 05-07 / T-05-SC | This plan introduces no package installation; hosted downloads use Node's built-in fetch. | 05-07-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-09 | 05-08 / T-05-SC | This plan introduces no package installation. | 05-08-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-10 | 05-09 / T-05-SC | This plan introduces no package installation. | 05-09-PLAN.md threat-model disposition; 05-RESEARCH.md Package Legitimacy Audit | 2026-10-26 |
| AR-05-11 | 05-07 / T-05-10, WR-03 residual | Redirect checks classify URL host text; a DNS name resolving to a refused address can pass. D-PL5-31 explicitly accepts this limit. Literal-address controls remain required. | User decision D-PL5-31 in 05-CONTEXT.md; WR-03 residual in 05-REVIEW-FIX.md | 2026-10-27 |

AR-05-11 documents a residual within T-05-10. It is not an additional authored threat row or an additional authored accept disposition. The log therefore has 11 entries for 10 authored accept dispositions plus one accepted residual.

## Open Findings

None. CR-01 was resolved by `cd7fdcf5`: all supported IPv4 representations use the complete metadata/private-address refusal predicate. CR-02 was resolved by `3a8c7e1c`: successful marketplace-info names are redacted before output. The earlier failed-info correction in `c99c6832` remains intact. Both fixes were independently rechecked under T-05-10 and T-05-17. D-PL5-31 remains an accepted DNS residual, not an open threat.

## Unregistered Flags

None. All nine SUMMARY Threat Flags map to the authored register. WR-03's residual maps to T-05-10 and D-PL5-31.

## Additional Verification

- Add and source repair run inside `withLockedStateTransaction` at `orchestrators/marketplace/add.ts:1052`.
- Refresh reloads its record under the same transaction boundary at `orchestrators/marketplace/update.ts:684`, then refreshes and saves.
- Removal performs the resource fold inside its locked transaction at `orchestrators/marketplace/remove.ts:1333`.
- Replacement validates the new marketplace name before setting the previous clone aside; failed placement or persistence restores the prior clone through the existing unwind path.
- D-PL5-27 and D-PL5-28 name refusals remain active on refresh. Hosted refusal occurs before the catalog rename.
- Fresh `npm run check` at `3a8c7e1c6b9af4e0f7c1646e67da622829eb525e` passed on Node `v26.12.1`: 1,124 scenarios, 11,462 steps, and 309 LCOV records. Inspected direct coverage: hosted-manifest-fetch.ts 305/305 lines, 18/18 functions, 87/87 branches; notification-present.ts 308/308 lines, 11/11 functions, 45/45 branches; notification-json.ts 759/759 lines, 54/54 functions, 236/236 branches. No non-planning inputs changed through audited HEAD `b49106b3`. The auditor did not rerun the full gate.
- No source or test file was changed by the auditor.

## Security Audit Trail

The initial read-only audit found 18 verified mitigation rows, one low implementation gap, and ten accept dispositions awaiting this log: 18 closed and 11 non-blocking open.

The accepted-risk log was persisted in `d079eab7`, closing all ten acceptance-documentation gaps. T-05-17 was fixed in `c99c6832` and rechecked against the implementation, real presentation-to-wire tests, command-level scenario, and direct coverage. Final verdict: SECURED — 29/29 authored rows closed, comprising 19 verified mitigations and ten documented accepted dispositions.

The final security recheck at `b49106b3` verified CR-01 and CR-02 against implementation/test HEAD `3a8c7e1c`, independently exercised their controls, and reconciled all 29 register rows with the 11-entry accepted-risk log. Final verdict: SECURED; no blocking or non-blocking threat remains.

| Audit Date | Authored Rows | Verified Mitigations | Authored Accepted Dispositions | Blocking Open | Non-blocking Implementation Open |
|------------|---------------|----------------------|-------------------------------|---------------|---------------------------------|
| 2026-10-28 | 29 | 18 of 19 | 10, mapped above | 0 | 1 |
| 2026-10-28, final recheck at c99c6832 | 29 | 19 of 19 | 10, verified in persisted log | 0 | 0 |
| 2026-10-28, final recheck at b49106b3 | 29 | 19 of 19 | 10, verified in persisted log | 0 | 0 |

No blocking or non-blocking threat remains. `threats_open: 0` is confirmed at block_on high. The additional accepted DNS residual does not increase the authored-row count.

## Sign-Off

- [x] Every authored threat has a disposition.
- [x] Every authored accepted disposition has a distinct log entry.
- [x] The accepted DNS residual is distinguished from an implementation gap.
- [x] No blocking threat remains at block_on high.
- [x] T-05-17 mitigation verified.
- [x] Persisted artifact rechecked and final status recorded.

**Approval:** verified 2026-10-28; SECURED at `b49106b3b846ee13847d89eec8479bd40366f5c7`, with implementation/test inputs at `3a8c7e1c6b9af4e0f7c1646e67da622829eb525e`.
