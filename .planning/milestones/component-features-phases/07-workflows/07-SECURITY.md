---
phase: "7"
slug: "workflows"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Plugin script -> engine storage | The bridge copies third-party workflow script bytes into an envelope the engine loads and runs | Executable JavaScript (untrusted) |
| Typed command -> engine run | A typed `/<plugin>:<name>` starts the script in the engine's vm realm with no approval prompt | Typed arguments (user) |
| Test step -> profile Pi settings | A Phase 7 step merges a `packages` entry into the scenario's Pi settings and restores it at release | Test configuration (sandbox only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Repudiation | listing filter (engine path plus a colon) | low | mitigate | Listings compared whole (`deepStrictEqual` in `listing.steps.ts`) | closed |
| T-07-02 | Tampering | lingering command after uninstall | medium | mitigate | `lifecycle.feature` pins the engine's stale notice, no progress entry, no model call | closed |
| T-07-03 | Spoofing | U+2014 projection in the notices `Then` | low | accept | Only U+2014 maps to `--`, in one named constant | closed |
| T-07-04 | Tampering | nondeterministic or unparseable script written into engine storage | medium | mitigate | Refused at install (`domain/workflow-script.ts` determinism and parse checks, D-CF7-03); pinned in `refusals.feature` | closed |
| T-07-05 | Elevation of privilege | a noted script registers a runnable command | medium | mitigate | The engine refuses it before any run; `refusals.feature` pins the `failed:` notice, no progress entry, no model call | closed |
| T-07-06 | Spoofing | control characters in a note line | low | accept | `forMessage` escapes `\p{Cc}`/`\p{Cf}` (existing) | closed |
| T-07-07 | Elevation of privilege | script runs on its typed command with no approval | medium | transfer | Engine and Pi own the run path; recorded as Pi gap D-CF7-01 in `docs/workflows-compatibility.md`; `run.feature` pins that no dialog appears | closed |
| T-07-08 | Tampering | Claude Code string `args` vs engine object | low | accept | Divergence D-CF7-02, pinned by the `run.feature` Outline | closed |
| T-07-09 | Tampering | settings `packages` entry outliving its scenario | medium | mitigate | `companion-missing.steps.ts` refuses an existing `packages` member, merges, and restores the exact text at `onRelease` (changed from the planned `wx` write, P7-DC-13) | closed |
| T-07-10 | Information disclosure | absolute peer-cache path in the sandbox settings file | low | accept | Sandbox-only file, restored at release | closed |
| T-07-11 | Tampering | retired command runs a removed or replaced script | medium | mitigate | `lifecycle.feature` pins the stale notice after uninstall and disable and the `stale workflow command` reason | closed |
| T-07-12 | Repudiation | session that ran an update lists the old description | low | accept | Pi gap (no command replacement); pinned so a change shows | closed |
| T-07-13 | Repudiation | decision record overstating upstream | low | mitigate | Every Claude Code claim carries its evidence grade in `docs/workflows-compatibility.md` | closed |
| T-07-14 | Tampering | gate fix weakening a test | medium | mitigate | No product or unit-test file changed in the phase; no skipped or disabled scenario; full gate green (07-06) | closed |
| T-07-SC | Tampering | package installs | low | accept | No package installed; `install-test-peers.mjs` fills the peer cache from `package.json` floors | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-03 | Test-only character projection, one named constant | Phase 7 plan threat model (autonomous run) | 2026-11-01 |
| AR-07-02 | T-07-06 | Existing escaping in `forMessage`; fixtures carry no control characters | Phase 7 plan threat model (autonomous run) | 2026-11-01 |
| AR-07-03 | T-07-07 | Transferred: the engine and Pi own the run path; recorded divergence D-CF7-01 | Phase 7 plan threat model (autonomous run) | 2026-11-01 |
| AR-07-04 | T-07-08 | Documented divergence D-CF7-02 | Phase 7 plan threat model (autonomous run) | 2026-11-01 |
| AR-07-05 | T-07-10 | Sandbox-only path, restored at release | Phase 7 plan threat model (autonomous run) | 2026-11-01 |
| AR-07-06 | T-07-12 | Pi gap; pinned so a change is visible | Phase 7 plan threat model (autonomous run) | 2026-11-01 |
| AR-07-07 | T-07-SC | No package installed | Phase 7 plan threat model (autonomous run) | 2026-11-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 15 | 15 | 0 | Phase 7 orchestrator (L1 grep verification; ASVS 1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
