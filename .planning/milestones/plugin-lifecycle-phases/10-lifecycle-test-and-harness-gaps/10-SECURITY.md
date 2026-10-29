---
phase: "10"
slug: "lifecycle-test-and-harness-gaps"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-27"
audited_commit: 3fde60a7
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Fixture input → persisted test state | Phase 10 helpers materialize manifests and records used by owner tests. | Marketplace names, plugin names, manifest paths, and state records |
| PTY driver → Pi process | The Cucumber harness starts Pi and local stand-ins inside an isolated sandbox. | Arguments, environment values, terminal bytes, and process signals |
| Failure objects → user notifications | Install, cascade, apply, and import failures become rendered command output. | Cause chains, rollback details, recovery paths, and credentials |
| Package child → OS process tree | A package manager can spawn descendants beyond its direct child. | Process identifiers, signals, timeout state, and exit status |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Tampering | marketplace fixture seeder | medium | mitigate | `marketplace-seed.ts` validates names, checks path containment before writes, writes manifests before returning a record, and has a symlink-refusal regression. | closed |
| T-10-02 | Tampering | PTY and local stand-ins | high | mitigate | The sandbox is validated before a fixed Python bridge is spawned with argument arrays; RPC paths are contained, the environment is allowlisted, and the git stand-in binds loopback. | closed |
| T-10-03 | Denial of service | PTY process lifecycle | high | mitigate | Readiness, quiet, and shutdown waits are bounded; cleanup registration precedes readiness; teardown kills the process group. | closed |
| T-10-04 | Information disclosure | cascade failure rendering | high | mitigate | `composeCascadeFailureMessage` applies `redactedRollbackPartials`; owner tests cover nested rollback causes and rendered output. | closed |
| T-10-05 | Tampering | CAS failure identity projection | medium | mitigate | Typed resolved and planned members flow into messaging; identity deduplication does not parse free-form errors or re-walk the catalog. | closed |
| T-10-06 | Tampering | marketplace add from apply/import | high | mitigate | Apply and import reuse the locked marketplace-add path, validated manifest loading, containment checks, and atomic config writes. | closed |
| T-10-07 | Information disclosure | apply rollback rendering | medium | mitigate | Apply redacts rollback children before outcome construction. | closed |
| T-10-08 | Information disclosure | install failure rendering | high | mitigate | Install redacts rollback children and ordinary root cause chains; owner and Cucumber tests reject absolute sandbox paths. Typed `StateLockHeldError` deliberately retains its documented recovery path (`docs/output-catalog.md`) and is covered separately. | closed |
| T-10-09 | Spoofing | update failure classification | medium | mitigate | Shared transport classification distinguishes invalid manifests from retryable host failures; focused scenarios pin both routes. | closed |
| T-10-10 | Tampering | failed-add fixture | medium | mitigate | A loopback invalid-JSON add proves no record remains, then repairs and retries successfully with a complete persisted-map assertion. | closed |
| T-10-11 | Denial of service | package process tree | high | mitigate | Termination escalates through process groups or Windows process trees; real-child and group-signal tests prove descendant cleanup. | closed |
| T-10-12 | Spoofing | coverage ledger | medium | mitigate | The checker enforces one evidence row per source item, commit existence, evidence paths and titles; it passes 56/56, and the clean combined gate passes. | closed |
| 10-01 / T-10-SC | Tampering | package installs | low | accept | Plan 10-01 installs no package. | closed |
| 10-02 / T-10-SC | Tampering | package installs | low | accept | The harness installs no package; it uses Python/Node standard libraries and the existing Pi runtime. | closed |
| 10-03 / T-10-SC | Tampering | package installs | low | accept | Plan 10-03 changes no dependency. | closed |
| 10-04 / T-10-SC | Tampering | package installs | low | accept | Plan 10-04 changes no package. | closed |
| 10-05 / T-10-SC | Tampering | package install | low | accept | The existing supported-manager allowlist is unchanged. | closed |
| 10-06 / T-10-SC | Tampering | package installs | low | accept | Plan 10-06 changes no package. | closed |
| 10-07 / T-10-SC | Tampering | package installs | low | accept | No PTY dependency is installed; Plan 02 uses a checked-in Python standard-library bridge with availability and CI smoke checks. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party).*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | 10-01 / T-10-SC | This plan installs no package. | Phase 10 plan decision | 2026-10-27 |
| AR-10-02 | 10-02 / T-10-SC | No package is installed; the harness uses Python/Node standard libraries and the existing Pi runtime. | Phase 10 plan decision | 2026-10-27 |
| AR-10-03 | 10-03 / T-10-SC | No dependency change in this plan. | Phase 10 plan decision | 2026-10-27 |
| AR-10-04 | 10-04 / T-10-SC | No package change. | Phase 10 plan decision | 2026-10-27 |
| AR-10-05 | 10-05 / T-10-SC | Existing supported-manager allowlist is unchanged. | Phase 10 plan decision | 2026-10-27 |
| AR-10-06 | 10-06 / T-10-SC | No package changes. | Phase 10 plan decision | 2026-10-27 |
| AR-10-07 | 10-07 / T-10-SC | No PTY dependency is installed; Plan 02 uses a checked-in Python standard-library bridge with availability and CI smoke checks. | Phase 10 plan decision | 2026-10-27 |

The plan-qualified references preserve the seven distinct acceptance rationales. They are not silently deduplicated despite sharing the `T-10-SC` label.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 19 | 19 | 0 | GSD security auditor, ASVS L1 |
| 2026-10-28 | 19 | 19 | 0 | GSD security re-auditor, ASVS L1 |
| 2026-10-28 | 19 | 19 | 0 | GSD final post-merge security auditor, ASVS L1 |
| 2026-10-29 | 19 | 19 | 0 | GSD final integrated security auditor, ASVS L1 |

Evidence was audited at `689b4499`. The coverage checker passed 56/56 rows. The full repository gate exited 0 with 1,119 scenarios, 11,393 steps, and 304 direct LCOV records.

The stale-verification re-audit traced the current post-split implementation at
`7f76cda2`. All 12 mitigations remain present, all seven accepted-risk entries
remain documented, and no unregistered or reopened threat was found. The
current coverage checker passes 56/56 rows; the latest combined repository
gate on the unchanged build inputs passed 1,126 scenarios, 11,509 steps, and
309 direct LCOV records.

The final post-merge audit traced the integrated tree at `0d36e2a3`. All 12
declared mitigations remain present and all seven accepted risks remain
documented. The streaming-git wait-cap fixture clears its heartbeat on response
close, and refresh, plugin update, dependency settlement and reporting remain
inside gate-owned abort scopes. PTY and RPC children retain realpath-contained
sandboxes, allowlisted environments, bounded readiness and shutdown, and
process-group cleanup. Notification boundaries redact paths, credentials,
stored identities and background-update versions before text or JSON rendering.
Package-manager timeouts terminate POSIX process groups or Windows process
trees. The Phase 10 coverage checker now binds every evidence path and title to
its cited commit through argument-array `git show`, while retaining current-tree
containment and existence checks.

The coverage ledger passed 56/56 rows. Its negative commit-binding mutation was
rejected. The integrated `npm run check` passed static checks, 1,131 scenarios,
11,584 steps, and 309 direct LCOV records. No unregistered or reopened threat
was found.

The final integrated audit traced the executable tree at `f310906d`. All 12
mitigations and seven accepted risks remain closed. Ambiguous quoted absolute
paths now fail closed unless they have exactly one safe matching delimiter.
The separate Node errno grammar accepts an arrow operation only when it has
exactly two operands; source, destination, and dual delimiter collisions fail
closed for `rename`, `copyfile`, `link`, and `symlink`. Cause-chain, cascade,
apply, install, and public-presentation projections retain that result.

Package-manager timeout escalation remains bounded and terminates POSIX
process groups or Windows process trees before settlement. The package-manager
owner passed 41/41, D-PL10-13 passed 1/1, and the strict coverage ledger passed
56/56. The exact unchanged-tree `npm run check` passed static checks, 1,144
scenarios, 11,758 steps, and 309 direct LCOV records. No unregistered or
reopened threat was found.

The final-head audit traced exact HEAD `3fde60a7`. All 19 authored rows remain
closed: 12 mitigations and seven documented plan-qualified accepted risks.
The strict coverage checker passes 56/56 rows, Nyquist is COMPLIANT for all
seven requirements and 28 truths, and the unchanged-input full gate is green
with 1,145 scenarios, 11,777 steps, and 309 LCOV records. The final complete
review is CLEAN across 130 files. No unregistered or open threat remains.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer).
- [x] Accepted risks documented in Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-10-29 after final-head audit at `3fde60a7`.
