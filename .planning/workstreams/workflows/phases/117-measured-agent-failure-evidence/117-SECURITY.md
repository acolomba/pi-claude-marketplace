---
phase: "117"
slug: "measured-agent-failure-evidence"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-09"
---

# Phase 117 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Scratch prefix → third-party code | The phase installs `@quintinshaw/pi-dynamic-workflows` and its transitive packages, three carrying install scripts, and EXECUTES them | Package tarballs from the npm registry |
| Canary → operator's real agent state | The driver must never write into `~/.pi/agent` | A sandbox path, refused before the engine is imported |
| Canary → provider | A run that reached a live provider would spend money and un-measure the result | Nothing — the failure is induced by an absent key |
| Measurement → published document | A grade upgraded on an unrun canary would repeat the defect this phase corrects | An engine version and a verdict, both from a recorded green run |
| Archived record → future reader | A record claiming work that never happened | The corrected claims, with the retired wording quoted rather than erased |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-117-01 | Tampering | scratch install of the engine + 3 install-script packages | high | mitigate | Prefix outside the repo; manifests untouched across the phase; `/tmp/wf-engine` absent; `node_modules/@quintinshaw` absent. `--ignore-scripts` deliberately NOT used — the peer's platform binary is placed by a post-install step, so using it would yield a broken measurement, not a safer one (`tests/live-uat/README.md:68`) | closed |
| T-117-02 | Tampering | the canary writing into the operator's real agent-state directory | high | mitigate | `assertSandboxContainment` (`workflow-agent-failure-canary.mjs:141-159`) called at `:189` — BEFORE `mkdir` (`:198`) and before the dynamic import (`:207`). Re-driven live during the audit against the real directory: refused at exit 1, nothing created | closed |
| T-117-03 | Repudiation | a green canary on a credentialed machine that measured nothing | high | mitigate | A0 at `:217-221` precedes A1's first assert at `:228`; `nothingWasMeasured` (`:89-102`) exits 1. Re-proven firing during the audit with a stub returning the shape a SUCCESSFUL call produces | closed |
| T-117-07 | Repudiation | a grade upgraded on an unrun canary | high | mitigate | Precondition at `117-02-PLAN.md:151`; the published grade reads `runtime-measured at 3.10.1 by tests/live-uat/workflow-agent-failure-canary.mjs`, backed by a green run at that version from two independent version reads | closed |
| T-117-12 | Repudiation | the archived record's over-claiming sites | high | mitigate | All five corrected, including the `evidence:` block that narrated a pass — the persuasive half. `result: CLOSED` = 0, `closed:` = 0, `live canary closed` outside blockquotes = 0, `WDOCS-02` tags = 7 | closed |
| T-117-18 | Repudiation | the phase's negative-control record | high | mitigate | Three verbatim failing transcripts located and read: `--invert` (`117-01-SUMMARY.md:90-116`), A0 planted (`:118-152`), citation gate (`117-02-SUMMARY.md`) | closed |
| T-117-SC | Tampering | npm/pip/cargo installs | high | mitigate (01, 03) / accept (02) | The only install is the scratch prefix, audited OK with registry provenance (`117-RESEARCH.md:166-179`), including a scoped-vs-unscoped near-name warning. Plans 02 and 03 install nothing; 03 asserts the prefix is gone | closed |
| T-117-04 | Information disclosure | the engine's failure message quoted into a committed record | medium | mitigate | Independent trufflehog filesystem scan over every committed phase file: 44 chunks, `verified_secrets: 0`, `unverified_secrets: 0`. The one verbatim message is a missing-key notice plus two `/tmp` paths — no key material | closed |
| T-117-08 | Spoofing | the section naming a driver path that does not resolve | medium | mitigate | Driver resolves; `no-stale-test-citations` re-run at exit 0, and proven to fire on a planted unresolvable path | closed |
| T-117-09 | Repudiation | a census figure a reader cannot reproduce | medium | mitigate | Figures carry marketplace, plugin versions (including the one declaring none), read date, and the occurrences-not-lines rule. The consequence is stated independent of any count | closed |
| T-117-10 | Tampering | a doc edit silently breaking a pinned case it does not mention | medium | mitigate | Both pinned suites re-run at pass 5 / fail 0; the edit adds and removes no bare-number table row | closed |
| T-117-13 | Tampering | a correction that rewrites history to look clean | medium | mitigate | Retired wording still legible at `105-VERIFICATION.md:15`, `:71`, `:127`, `:187-193`; every note dated and tagged | closed |
| T-117-14 | Repudiation | a numeric ledger citation pointing at an unrelated entry | medium | mitigate | Ledger id 45 appended via tooling, `[workflows-replay]`-prefixed. Independently confirmed id 5 is the unrelated Phase-112 deviation the note says it is | closed |
| T-117-15 | Repudiation | a success criterion silently changed between planning and verification | medium | mitigate | Four dated notes in `ROADMAP.md`, each naming its decision and quoting the retired wording | closed |
| T-117-16 | Tampering | a state verb regressing this workstream's state file | medium | mitigate | No state verb run; `completed_phases: 8`, `percent: 89` intact | closed |
| T-117-17 | Tampering | the scratch prefix left behind | medium | mitigate | `/tmp/wf-engine` absent; both manifest checks pass | closed |
| T-117-05 | Denial of service | a run reaching a live provider spends money and tokens | low | mitigate | Containment refusal plus A0; every run induced the absence-of-credentials failure, so no provider was reached | closed |
| T-117-06 | Elevation of privilege | third-party JavaScript executed by the engine inside its own realm | low | accept | Verified: script text is literal-only (`FAN_OUT_SCRIPT` at `:182-185`, literal call arguments at `:211` and `:245`). No external input reaches the script body | closed |
| T-117-11 | Information disclosure | a transcript or clone path pasted into a published document | low | mitigate | No transcript, no machine-local clone path, no credential material in the published doc | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-117-01 | T-117-06 | The scripts the canary runs are literal constants in the driver, not external input, so the engine's realm executes only text this repository authored | Phase 117 plan set | 2026-09-09 |
| R-117-02 | T-117-SC (plan 02) | That plan touches only markdown and adds, upgrades and removes no package | Phase 117 plan set | 2026-09-09 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 19 | 19 | 0 | Claude (gsd-security-auditor) |

---

## What the audit did beyond an L1 grep

This phase is unusual twice over: it installs and executes third-party code, and
it corrects a record that claimed work which never happened. The register was
authored at plan time and the level is L1, which permits closing on grep depth.
The four highest-consequence threats were instead **re-driven against the shipped
tree**.

**T-117-03 — the phase's own reason for existing, turned on itself.** A canary
that passes on a credentialed machine having measured nothing would be exactly
the defect this phase corrects, wearing new clothes. The audit stubbed a
`runWorkflow` returning `{ logs: [], result: { kind: "resolved", isNull: true } }`
— the shape a SUCCESSFUL call produces, and a result that would have **passed**
A1. The shipped file exited 1 with `NOTHING WAS MEASURED` and never read a
verdict. The guard is load-bearing, not decorative.

**T-117-02 — containment refuses today, not just in a transcript.** With a
resolvable engine manifest, so the check was genuinely reached rather than
short-circuited by an earlier failure, `PI_CODING_AGENT_DIR=$HOME/.pi/agent`
refused at exit 1 and created nothing under the real directory.

**T-117-01 / T-117-17 — the install left no trace.** Manifests untouched across
the entire phase range, engine absent from `node_modules`, scratch prefix gone.

**T-117-12 / T-117-13 — the correction is honest.** All five sites are corrected,
including the `evidence:` block. The retired claims are quoted rather than erased,
each note is dated and tagged, and each states what WAS genuinely closed on
2026-08-16 — the previous phase's route and its negative control.

## Findings recorded rather than fixed

- **One summary claim overstated its own verification and has been corrected.**
  `117-02-SUMMARY.md` said "no table row in the file begins with a bare number in
  its first cell"; nine pre-existing rows do, in the very table the pin scrapes.
  The operative property — that the edit added and removed no such row — always
  held and the audit confirmed it independently. The row now states that, with a
  dated note explaining the correction rather than quietly rewording it.
- **`Exit 0, every assertion PASS` is characterized rather than quoted verbatim**
  in the corrected `105-VERIFICATION.md` block. T-117-13's declared mitigation
  admits description as a legal shape and git history retains the original, so
  this is not a gap; the other four sites carry near-verbatim quotes.
- **New surface, not separately registered:** the driver dynamic-imports from a
  path named by `PI_WORKFLOW_ENGINE_ROOT`. Whoever sets that variable already has
  code execution on the machine, and the install-and-execute boundary is covered
  by T-117-01 and T-117-06. Informational.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] The four highest-consequence threats re-driven against the shipped tree, not closed on grep depth

**Approval:** verified 2026-09-09
