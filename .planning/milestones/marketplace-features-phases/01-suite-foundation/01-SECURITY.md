---
phase: "1"
slug: "suite-foundation"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-15"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| cucumber worker -> Pi child | The worker spawns Pi in a sandbox HOME, agent directory, and project directory; the developer's real home stays out of reach | sandbox paths, allowlisted env (no secrets) |
| extension -> step | Payload JSON is read only after schema validation | notification payloads (test data) |
| repository tree -> gate verdict | `scripts/check-features.mjs` decides whether a commit may land | feature files, step modules |
| feature file -> fixture writer | Marketplace names and kinds decide what fixtures write under the sandbox HOME | fixture paths (sandbox only) |
| step -> user-owned files | The config step reads `claude-plugins*.json` in the sandbox scope roots | sandbox config files |
| skill text -> reviewers and agents | Later phases act on what the cucumber skill tells them to run | review instructions |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | `features/support/pi-process.ts` sandbox; fixtures under HOME | high | mitigate | realpath'd temp run root (`pi-process.ts:15,48`); `_rpc.ts` resolveSandbox containment; fixtures under `<root>/home/marketplaces`; `Before()` empties and asserts | closed |
| T-01-02 | Repudiation | `features/lib/run-tokens.ts` projection | medium | mitigate | exact `replaceAll` of the one HOME (`run-tokens.ts:34`); `{scenario time}` only for `lastUpdatedAt` in window (`run-tokens.ts:43`); planted runs recorded in 01-01-SUMMARY | closed |
| T-01-03 | Tampering | `runCommandPayloads` / `ScenarioWorld.lastResult` | medium | mitigate | every payload validated against `NOTIFICATION_PAYLOAD_SCHEMA` (`pi-commands.ts:36`); exactly-one assertion (`world.ts:81`); kind row in every table | closed |
| T-01-04 | Information disclosure | sandbox paths in test output | low | accept | see Accepted Risks AR-01 | closed |
| T-01-05 | Repudiation | `scripts/check-features.mjs` verdict | high | mitigate | tag expression cleared (`check-features.mjs:105`); own verdict from the message stream; zero scenarios/definitions fail (`:201,205`); planted runs recorded in 01-02-SUMMARY | closed |
| T-01-06 | Denial of service | the gate inside `check:static` | low | mitigate | dry run (`check-features.mjs:107`) runs no hooks, so no Pi starts; observed once (no new `pi-cm-features-*` dir), 01-02-SUMMARY | closed |
| T-01-07 | Elevation of privilege | `eslint.config.js` features blocks | low | mitigate | blocks scoped to `features/step_definitions/**/*.steps.ts` (`eslint.config.js:221`) and `features/lib/**/*.ts` (`:245`); planted violations fail once | closed |
| T-01-08 | Information disclosure | url/github arms of `features/lib/published-marketplace.ts` | medium | mitigate | both arms throw before any I/O (`published-marketplace.ts:61,81`); `cucumber.json` excludes their rows | closed |
| T-01-09 | Tampering | fixture paths built from a marketplace name | low | accept | see Accepted Risks AR-02 | closed |
| T-01-10 | Repudiation | `the result lists these marketplaces:` | medium | mitigate | a block with plugin rows fails (`command.steps.ts:73`); empty result has its own step (`:126`); whole-table comparison | closed |
| T-01-11 | Information disclosure | `features/step_definitions/config.steps.ts` reads | low | mitigate | two allowed file names, any other throws (`config.steps.ts:27-35`); paths only from `ScenarioWorld.scopeRoot` (`world.ts:53-59`) | closed |
| T-01-12 | Repudiation | the two D-02 multi-payload steps | medium | mitigate | envelope table pins count, order, kind; rows step rejects a non-cascade (`command.steps.ts:60-64`); planted deletion and swap fail (01-04-SUMMARY) | closed |
| T-01-13 | Repudiation | config step (missing file passing as empty) | medium | mitigate | file existence asserted and path named (`config.steps.ts:16`, `existsSync`); planted missing-file run fails (01-04-SUMMARY) | closed |
| T-01-14 | Repudiation | review guidance in `SKILL.md` and `steps.md` | low | mitigate | both name `npm run check:features` (1 match each) | closed |
| T-01-SC | Tampering | npm/pip/cargo installs | low | accept | see Accepted Risks AR-03 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-04 | Paths name throwaway temp directories; the sandbox holds no secrets | plan 01-01 threat model | 2026-10-15 |
| AR-02 | T-01-09 | Names come from repository feature files; every fixture path is under the sandbox HOME, which `Before()` empties | plan 01-03 threat model | 2026-10-15 |
| AR-03 | T-01-SC | No plan in this phase installs a package; every library used was already in `package-lock.json` | plans 01-01..01-05 threat models | 2026-10-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-15 | 15 | 15 | 0 | secure-phase orchestrator (ASVS L1 grep-depth; register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-15
