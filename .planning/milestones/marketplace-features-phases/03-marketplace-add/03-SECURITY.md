---
phase: "3"
slug: "marketplace-add"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-16"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| step -> sandbox filesystem | Fixtures (malformed manifests, empty directories, a second marketplace directory) are written under the sandbox HOME | Test fixture files; no secrets |
| Pi child -> sandbox HOME | A typed `~/` path is expanded by the extension inside Pi, whose HOME is the sandbox | Paths only |
| Pi child -> project scope files | `--local` commands write `claude-plugins.json` and `claude-plugins.local.json` under the sandbox project root | User-owned config in the sandbox |
| extension -> step | Command payloads are compared only after the driver validates them against the schema | Notification payloads |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | `add.steps.ts` directory step; `writeMalformedManifest` | low | mitigate | Paths join under `world.marketplacesRoot` and each step registers its release before writing (`features/step_definitions/marketplace/add.steps.ts:54-55,64-65`) | closed |
| T-03-02 | Information disclosure | the `~/marketplaces/missing` row | medium | mitigate | The Pi child's HOME is the sandbox (`tests/e2e/_rpc.ts:169`, sandbox from `features/support/pi-process.ts:52`); no step expands `~` | closed |
| T-03-03 | Repudiation | ADD-06/ADD-07 scenarios (a false pass) | medium | mitigate | Whole envelope and row compared; planted checks recorded in `03-01-SUMMARY.md` "Planted Checks", none committed | closed |
| T-03-04 | Tampering | manifest cache (stale parse across scenarios) | low | mitigate | Three manifest contents measure 57, 61, and 56 bytes at one path (size probe in `03-01-SUMMARY.md`) | closed |
| T-03-05 | Information disclosure | `@url` rows of the ADD-06/07 Outlines | low | accept | Excluded by `cucumber.json`; url arm throws `noStandIn`; Pi runs offline | closed |
| T-03-06 | Tampering | `publishMarketplaceIn` and the second-publish step | low | mitigate | Directory joins under the sandbox marketplaces root (`features/lib/published-marketplace.ts:84`); the step records nothing on the world | closed |
| T-03-07 | Repudiation | ADD-04 (duplicate reported but record overwritten) | medium | mitigate | The project `claude-plugins.json` is compared whole after the failed add; the `tools-copy` row catches a source-keyed check (`features/marketplace/add.feature`, ADD-04 Outline) | closed |
| T-03-08 | Repudiation | ADD-05/ADD-02 (pass on the wrong scope) | medium | mitigate | Row scope and each scope's config file compared whole; planted scope swaps recorded in `03-02-SUMMARY.md` | closed |
| T-03-09 | Information disclosure | `@url` and `@github` rows of ADD-04/05 | low | accept | Excluded by `cucumber.json`; git arm throws `noStandIn`; Pi runs offline | closed |
| T-03-10 | Tampering | `--local` scenarios writing into a real project's `.pi/` | medium | mitigate | Pi's cwd is the sandbox project; `ScenarioWorld.scopeRoot` reads `<sandbox cwd>/.pi` (`features/support/world.ts:65-71`); Before() empties the sandbox | closed |
| T-03-11 | Repudiation | a `--local` scenario passing while the declaration leaks into the base file | medium | mitigate | Both config files compared whole in each `--local` scenario; no reload separates command and checks (D-08 left to Phase 3.1) | closed |
| T-03-12 | Repudiation | the phase gate record | low | mitigate | `npm run check` exit 0 recorded with commit, Node version, and scope in `03-03-SUMMARY.md` | closed |
| T-03-SC | Tampering | package installs | low | accept | No plan installed a package | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-05 | The `@url` rows cannot run until the HTTPS git stand-in lands in Phase 9; until then they are excluded and dry-run only | plan 03-01 threat model | 2026-10-16 |
| AR-03-02 | T-03-09 | The `@url` and `@github` rows wait for Phases 9 and 10 in the same way | plan 03-02 threat model | 2026-10-16 |
| AR-03-03 | T-03-SC | No package was installed in this phase | plans 03-01..03-03 threat models | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-16 | 13 | 13 | 0 | secure-phase orchestrator (ASVS L1 grep-depth; register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-16
