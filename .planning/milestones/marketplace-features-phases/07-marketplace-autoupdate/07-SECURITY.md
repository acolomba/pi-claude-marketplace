---
phase: "7"
slug: "marketplace-autoupdate"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-20"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Command name → not-added result | A miss reports only the typed name and reason; an unscoped miss carries no invented scope. | Marketplace names and scope markers |
| Layer configs → flip plan | A `--local` flip may write only the local config; the base config is read for the inherited value and never written. | User-owned `claude-plugins.json` / `claude-plugins.local.json` |
| Invalid base config → inherited value | An unreadable base config fails the flip closed (CFG-03) before any write, never defaulting to off. | Config bytes and basename-only error causes |
| Scenario steps → filesystem | The raw-text config writer and reader resolve paths only under the scenario sandbox's scope roots. | Hand-written config text |
| Feature rows → network | `@url`/`@github` rows stay excluded at run time; no scenario reaches the network. | None at run time |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Information disclosure | `notifyNamedMiss` payload | low | mitigate | Conditional scope spread (`autoupdate.ts:624`); the AU-08 Outline compares the whole field set | closed |
| T-07-02 | Tampering | config files on a missed flip | medium | mitigate | `MarketplaceNotFoundError` is thrown in planning (`autoupdate.ts:420`, `:445`) before `writeFlipPlan` (`:534`); the AU-08 and D-07 Outlines assert unchanged configs | closed |
| T-07-03 | Tampering | `--local` flip write path | high | mitigate | Only the local layer enters `plan.writes` under `--local`; the base is read as a `ConfigLoadResult` (`everyFlipLayers`, `autoupdate.ts:470`) that never reaches `writeFlipPlan`; owner cases assert unchanged base bytes | closed |
| T-07-04 | Tampering | inherited value from an invalid base config | high | mitigate | `inheritFrom` (`autoupdate.ts:301`) throws `invalidConfigError` inside planning (`:304`) and never defaults to off; owner cases and the D-05 scenario pin the CFG-03 row and unchanged configs | closed |
| T-07-05 | Information disclosure | CFG-03 cause line | low | mitigate | `invalidConfigError(path.basename(...))` (`autoupdate.ts:290`, `:304`) names only the basename | closed |
| T-07-06 | Tampering | base lookups for inheritance (prototype-named keys) | low | mitigate | `inheritFrom`/`inheritAfterFlip` read through `ownValue` (`autoupdate.ts:308`, `:315`) | closed |
| T-07-07 | Tampering | raw-text config writer step | medium | mitigate | `writeLayerText` is reached only through `layerConfigPath`, which joins under `world.scopeRoot` (`config.steps.ts:56-62`, `:138-139`) | closed |
| T-07-08 | Tampering | planted pre-fix `autoupdate.ts` (RED run) | medium | mitigate | Restored with `git checkout --`; only `a7ff6db7` and `fc43090a` touch `extensions/` in this phase, and no 07-03 commit does | closed |
| T-07-09 | Information disclosure | docs and CHANGELOG prose | low | accept | Prose only; no path, credential, or record data added | closed |
| T-07-10 | Information disclosure | `@url`/`@github` Outline rows | low | mitigate | `cucumber.json` unchanged since `c06547fa` (tag exclusion intact); rows are only dry-run by `check:features` | closed |
| T-07-11 | Tampering | user configs during scenarios | low | mitigate | Scenarios run in the harness sandbox (HOME, agent directory, project) and use `{home}` tokens; none touches the developer's home or the repo's `.pi/` | closed |
| T-07-SC | Tampering | npm/pip/cargo installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `c06547fa`; no package installed or added | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-09 | Documentation and CHANGELOG prose carry no paths, credentials, or record data; disposition `accept` was authored at plan time (07-03). | plan 07-03 threat model | 2026-10-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-20 | 12 | 12 | 0 | secure-phase (orchestrator, ASVS L1 grep-depth short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-20

## Security Audit 2026-10-20

| Metric | Count |
|---|---|
| Threats found | 12 |
| Closed | 12 |
| Open | 0 |
