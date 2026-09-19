---
phase: "07"
slug: "reliable-coverage-metrics"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-18"
register_authored_at_plan_time: true
---

# Phase 07 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Source/test/tool inputs to capture | Executed bytes must match the immutable run identity | Source bytes, executed JavaScript, tool identities (hashed) |
| Raw/converted artifacts to metric consumer | Coordinates, syntax identities, counters and freshness are independently validated before any verdict | Raw V8, Istanbul map, manifest, receipt |
| Vendored dependency artifact to execution | Only the reviewed exact producer and tested tooling supply conversion behavior | Vendored tarball, patch, license, lock integrity |
| CI runner to published artifacts | The runner qualifies the producer and captures its own bundle; nothing published is trusted across runners | Coverage bundle, LCOV, risk report |

---

## Threat Register

The eight PLAN registers (T-07-01-\* through T-07-08-\*) are identical; each row below stands for its eight plan-scoped IDs. All dispositions are `mitigate`. Evidence paths are relative to the repository root.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-0[1-8]-01 | Tampering | Run/coverage identity | high | mitigate | Content hashes over inventory, raw records, stored and executed source and published LCOV (`scripts/coverage-capture.mjs:175,321,433,487,590`; `scripts/coverage-capture.runtime.mjs:181-182`; `scripts/coverage-capture.manifest.mjs:194,278`); complete-set and worker reconciliation refusals (`coverage-capture.mjs:271,313,336-348,384`); atomic manifest publication (`coverage-capture.manifest.mjs:127`, `coverage-capture.mjs:570`, `scripts/coverage-unit.mjs:286`); stale and substituted artifacts refused on readback (`coverage-unit.mjs:198-207`, `scripts/coverage-validate.mjs:221,322,379`) | closed |
| T-07-0[1-8]-02 | Tampering | Producer omissions and consumer fallback | high | mitigate | Independent acorn walk (`scripts/coverage-syntax.mjs:8,13`; `scripts/coverage-correspondence.mjs:192-206,303-311`) applied before any verdict (`coverage-validate.mjs:230-233`; `scripts/check-coverage-risk.mjs:536-547,582-585`); offender controls for dropped records, missing functions and statements, unloaded hits, opposite-coverage twins, deleted nested functions, counter swaps and wrong joins (`scripts/coverage-unit.negative.mjs:494,531,540,549`; `scripts/check-coverage-risk.negative.mjs:115,537,609,656`) | closed |
| T-07-0[1-8]-03 | Information disclosure | Artifact paths and cleanup | medium | mitigate | Every manifest path passes `toProjectPath`, which rejects `..`, absolute and empty paths (`coverage-capture.manifest.mjs:134-137`; `coverage-capture.runtime.mjs:103-105`); explicit destinations (`coverage-validate.mjs:318`; `check-coverage-risk.mjs:711`; `coverage-unit.mjs:364`); cleanup limited to owned run directories matching `RUN_ID_PATTERN` under `RUNS_DIRECTORY` (`coverage-unit.mjs:362-376`; `coverage-capture.mjs:144-145`) and to each control's own `mkdtemp` workspace | closed |
| T-07-0[1-8]-04 | Repudiation | Child process outcomes | medium | mitigate | Launch, signal and status failures are distinguished and the consumer's stderr is relayed when it yields no report (`coverage-capture.mjs:252-262`; `coverage-unit.mjs:156-170,333-346`; `check-coverage-risk.mjs:212-214,223-228,251`); harness controls require exact status 1 and the exact row set, then restore and require the pass (`coverage-unit.negative.mjs:276,294-303`; `check-coverage-risk.negative.mjs:384,398-407`) | closed |
| T-07-0[1-8]-SC | Tampering | npm development tooling | high | mitigate | Pinned vendored spec (`package.json:23`) with lock integrity matching the tarball's sha512 (`package-lock.json:3947-3951`); provenance and MIT license digests pinned and byte-compared (`vendor/coverage/PROVENANCE.md`; `scripts/build-coverage-producer.mjs:41-72,265-289`); patch reverse-applied with exact context (`build-coverage-producer.mjs:187-216`); `pack --ignore-scripts` (`:408`); producer qualified from its bytes before `import()` (`scripts/coverage-producer.convert.mjs:113-125,161-171`) and a divergent producer refused by the validator (`coverage-validate.mjs:337-343`); scripts-disabled installs in every workflow (`ci.yml:80,114,136,187,248`; `lint.yml:45`; `sonarcloud.yml:60`) and in the hook (`.pre-commit-config.yaml:125`) | closed |

*Status: open · closed · open -- below high threshold (non-blocking)*
*Severity: critical > high > medium > low -- only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| -- | -- | No accepted risks; every registered threat is mitigated | -- | -- |

---

## Unregistered Flags

Every SUMMARY `## Threat Flags` entry maps to a registered threat:

- 07-01 `file-access` (the preload writes to `PI_CM_COVERAGE_RUN_DIR` without its own root-containment check) -> T-\*-03. Informational: the CLI sets that variable to `<root>/coverage/runs/<id>` (`coverage-capture.mjs:196,204`) and every recorded path is contained by `toProjectPath`.
- 07-02 `dependency`, `network` -> T-\*-SC.
- 07-04 `file-write` (receipt) -> T-\*-01 / T-\*-03.
- 07-05 and 07-06 `file-write`, `subprocess` -> T-\*-03 / T-\*-04.

Informational, no gap: `scripts/coverage-producer.mjs:398` exposes a `--producer` entry seam that records qualification failures instead of throwing (`coverage-producer.convert.mjs:163`). The production pipeline never passes it (`coverage-unit.mjs:225-228`), and any stand-in leaves a recorded identity the validator refuses.

---

## Audit Trail

| Date | Action | Result |
|------|--------|--------|
| 2026-09-18 | Retroactive verification by the security auditor after the phase closed (ASVS L1, block_on high), following the post-execution code review whose five warnings were fixed in `bc8f5496`..`0844c2a7` | SECURED -- 40/40 threat rows closed, `threats_open: 0`, no implementation files modified |
