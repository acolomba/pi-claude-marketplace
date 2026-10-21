---
phase: "8"
slug: "marketplace-help-and-usage-errors"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-20"
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User command text → edge argument parsers | Typed flags and values cross into `parseArgs`, the `--local` scan, `parseCommandArgs`, `parsePluginRef`, and `parsePluginTarget`. | Flags, marketplace names, plugin references |
| Edge handler → orchestrator | An empty, blank, or malformed value must stop at the edge, before any state lookup, lock, clone, or write. | Parsed command arguments |
| Help text → user | The help tells a user which flags each marketplace verb accepts; a wrong line leads to a command that writes the wrong layer. | Usage lines |
| Handler modules → router module | Handlers value-import `marketplaceUsage` from the router; a back-import would close a module cycle. | Module imports |
| Scenario → headless Pi sandbox | Scenarios drive the real extension against sandboxed scopes. | Sandboxed config and state |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Information disclosure | usage-error messages that echo a typed token | low | accept | The echoed token is the user's own input, returned to the same session in the structured `message` field (AR-08-01) | closed |
| T-08-02 | Tampering | user configs during the scenarios | low | mitigate | Scenarios run in the harness sandbox (`features/support/pi-process.ts`) and are rejected at the edge; `cucumber.json` has no diff since `779eeced` | closed |
| T-08-03 | Tampering | `MARKETPLACE_USAGE` drifting from a verb's accepted flags | low | mitigate | One signature row per verb builds the help line and the verb's usage line; all six handlers read `marketplaceUsage(verb)` (`add.ts:27`, `remove.ts:24`, `list.ts:22`, `info.ts:17`, `update.ts:34`, `autoupdate.ts:25`); help scenarios and `flag-catalog-drift.test.ts` pin the lines | closed |
| T-08-04 | Denial of service | module load order between `edge/router.ts` and the marketplace handlers | low | mitigate | `router.ts` imports no handler (only `notification-dispatch.ts` and two type imports, `router.ts:24-27`); the `fallow --circular-deps` run in `npm run check` passed at `1175e83d` | closed |
| T-08-05 | Tampering | `parseCommandArgs` and its callers | medium | mitigate | `args-schema.ts:118` rejects a supplied empty or blank labelled positional with `<label> must not be empty.` before any orchestrator runs; the handler owners assert no fetch, no clone, and untouched strict mocks for `""` | closed |
| T-08-06 | Information disclosure | the label messages | low | accept | Each label is a fixed literal at its call site, so the message echoes no user input (AR-08-02) | closed |
| T-08-07 | Tampering | `install ''` and `info ''` reaching the install and info workflows | low | mitigate | `parsePluginRef` (`plugin/shared.ts:47`) runs before the orchestrator call (`install.ts:77` before `installPlugin` at `:82`; `info.ts:61`); the owners assert the unchanged footprint | closed |
| T-08-08 | Repudiation | plugin `list ''` reporting an empty listing as a success | low | mitigate | `list.ts:64` rejects an empty or blank marketplace name before `listPlugins` (`:72`); the list owner asserts no transport call | closed |
| T-08-09 | Tampering | an `@` with a blank name reaching `reinstallPlugins` or `updatePlugins` | low | mitigate | `parsePluginTarget` (`plugin/shared.ts:80`) rejects it before any orchestrator call (`update.ts:52`, `fetch.ts:75`, `reinstall.ts:51`); the owners assert `NOTHING_UPDATED` / `NOTHING_REINSTALLED` | closed |
| T-08-10 | Information disclosure | CHANGELOG prose and the review record | low | accept | Prose only; no path, credential, or record data (AR-08-03) | closed |
| T-08-11 | Tampering | phase gate evidence | low | mitigate | `08-05-SUMMARY.md` records `npm run check` read from its own exit status (exit 0 at `427f4fdf`) and the parsed fallow audit verdict `pass`; the orchestrator's post-merge run exited 0 at `1175e83d` | closed |
| T-08-SC | Tampering | npm/pip/cargo installs | high | mitigate | `package.json` and `package-lock.json` have no diff since `779eeced`; no package installed or added | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-01 | The echoed flag or `--scope` value is the user's own input, returned to the same session; no path, record, or credential is added. Disposition `accept` was authored at plan time (08-01). | plan 08-01 threat model | 2026-10-20 |
| AR-08-02 | T-08-06 | Each label is a fixed literal at its call site, so `<label> must not be empty.` echoes no user input. Disposition `accept` was authored at plan time (08-03). | plan 08-03 threat model | 2026-10-20 |
| AR-08-03 | T-08-10 | CHANGELOG and review-record prose carry no paths, credentials, or record data. Disposition `accept` was authored at plan time (08-05). | plan 08-05 threat model | 2026-10-20 |

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
