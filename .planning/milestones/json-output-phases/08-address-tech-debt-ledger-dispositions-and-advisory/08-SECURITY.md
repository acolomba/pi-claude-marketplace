---
phase: "8"
slug: "address-tech-debt-ledger-dispositions-and-advisory"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-10"
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry to root lock | A registry artifact enters the project through the lock's resolved URL and integrity | `brace-expansion@5.0.12` tarball URL and sha512 integrity |
| Root lock to CI install | `npm ci` downloads and extracts exactly what the lock names | lock entries |
| Pi's published shrinkwrap to the nested tree | Upstream pins the nested copy; this repository cannot override it | `npm-shrinkwrap.json` inside `@earendil-works/pi-coding-agent` |
| Real user home to hermetic test home | The SC-2 case reads the global npm prefix from the real HOME, then writes only inside its temporary root | global `npm root -g` path |
| Global npm install to test scratch copy | The case copies the installed peer's `src` tree out of `node_modules` and imports it | pi-subagents source files |
| Measured facts to durable records | Carriers and deferred items become the audit trail a later milestone acts on | BACKLOG.md and deferred-items text |
| Reason text to the ledger | Free text becomes a permanent audit field that the `windows` verbs refuse to rewrite | waiver reasons |
| Ledger to the ship gate | `/gsd-ship` reads `open_count` from the ledger and blocks on any open entry | WINDOWS.md JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Tampering | `package-lock.json` `node_modules/brace-expansion` | high | mitigate | 08-01-01 and 08-01-03 asserted the lock integrity equals `npm view brace-expansion@5.0.12 dist.integrity` and the diff is exactly 3 lines (08-01-SUMMARY) | closed |
| T-08-02 | Repudiation | `npm audit` result | medium | mitigate | The Pi-nested entry stays 5.0.9 and is the single reported node (08-01-SUMMARY, 08-04-03 SC-3 check) | closed |
| T-08-03 | Denial of service | nested `brace-expansion` 5.0.9 pinned by Pi's shrinkwrap | low | transfer | Dev-only copy no attacker-controlled glob reaches; the fix belongs to Pi's shrinkwrap; carried as BACKLOG.md DEPADV-01 (08-03-01) | closed |
| T-08-SC (08-01) | Tampering | dependency acquisition (`brace-expansion@5.0.12`, rated `[SUS]` too-new) | high | mitigate | Package-legitimacy gate: blocking-human checkpoint 08-01-02 showed integrity, tarball, repository, maintainers, gitHead, and the absence of install scripts; the user approved on 2026-10-10; the bump ran with `--ignore-scripts` | closed |
| T-08-04 | Information disclosure | SC-2 / AGSK-06 case environment order | low | mitigate | Only the read-only `npm root -g` lookup runs before `createHermeticEnvironment`; every write stays inside the hermetic root (08-02-SUMMARY) | closed |
| T-08-05 | Repudiation | CI evidence for the provenance and resolver claims | low | accept | CI installs no global peer, so both cases skip there; the file-top TODO keeps the gap visible and the CI install is a deferred idea (08-CONTEXT.md) | closed |
| T-08-SC (08-02) | Tampering | dependency acquisition | low | accept | No package installation in the plan; the global peer is read where it already exists | closed |
| T-08-06 | Repudiation | DEPADV-01 and DEP-07-03-01 | low | mitigate | 08-03-01 re-measured the registry and branch facts before writing them and kept the sentence that the record does not claim `npm audit` passes (08-03-SUMMARY) | closed |
| T-08-07 | Repudiation | `01-VALIDATION.md` and `03-VALIDATION.md` frontmatter | low | mitigate | 08-03-02 changed one line per file; the node check rejects a still-ticked 01 box or a wrong frontmatter value (08-03-SUMMARY) | closed |
| T-08-SC (08-03) | Tampering | dependency acquisition | low | accept | No package installation in the plan; `npm view` is read-only | closed |
| T-08-08 | Repudiation | waiver reasons in `.planning/WINDOWS.md` | medium | mitigate | 08-04-01 passed each reason as one argv element, dry-ran the batch on a copy, and asserted exact reason equality (08-04-SUMMARY) | closed |
| T-08-09 | Tampering | WINDOWS.md table and JSON consistency | medium | mitigate | Only the `windows` verbs wrote the file; `windows status` still runs after the pre-commit fixers (08-04-SUMMARY) | closed |
| T-08-10 | Repudiation | fixed dispositions 85 and 89 | medium | mitigate | 08-04-02 re-ran `update.test.ts` (66/66) and the SC-2 case (`# pass 1`, `# skipped 0`) on the committed tree before marking them fixed (08-04-SUMMARY) | closed |
| T-08-11 | Repudiation | phase gate evidence | medium | mitigate | 08-04-03 ran `npm run check` unpiped (exit 0 at `0b5f7067`), read fallow's JSON verdict (`pass`), and pinned every diff to `a876e321` (08-04-SUMMARY) | closed |
| T-08-SC (08-04) | Tampering | dependency acquisition | low | accept | No package installation in the plan; `npm audit` and `npm view` only read | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-08-01 | T-08-03 | The nested `brace-expansion` 5.0.9 is pinned by Pi's own `npm-shrinkwrap.json` (0.87.1 through 1.0.0); it is a dev-only copy reached by no attacker-controlled glob, and it clears with the Pi >=1.0.1 bump carried as DEPADV-01 | user (CONTEXT D-08, 2026-10-10) | 2026-10-10 |
| R-08-02 | T-08-05 | CI installs no global pi-subagents peer, so the SC-2 and provenance cases skip there by design; the CI install is a recorded deferred idea | user (CONTEXT D-06, 2026-10-10) | 2026-10-10 |
| R-08-03 | T-08-SC (08-02, 08-03, 08-04) | Those plans install nothing; `npm view`, `npm audit`, and the global peer are read only | planner (plan threat models) | 2026-10-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-10 | 15 | 15 | 0 | secure-phase (orchestrator, L1 short-circuit: plan-time register, every mitigation evidenced in the plan SUMMARY verify results) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-10
