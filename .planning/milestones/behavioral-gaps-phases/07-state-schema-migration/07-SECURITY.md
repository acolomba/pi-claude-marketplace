---
phase: "7"
slug: "state-schema-migration"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-08"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. Audited inline by the orchestrator (P7-DC-12) against the threat model of 07-01-PLAN.md.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| A newer release's `state.json` to this release's `loadState` | Data from a schema this release cannot read reaches the load and every command | The installation record |
| Red-proof edits to the committed product tree | Temporary sabotage of owned product files | Product source |
| The test harness to the user's real Pi home | A run that escaped its sandbox would read or change installed plugins | Files under `~/.pi` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Tampering | `loadState` version gate | high | mitigate | S8, S9, and S10 assert unchanged config and record bytes after `list`, the load, and `disable`; R7 and R8 redden them | closed |
| T-07-02 | Tampering | red-proof sabotage in `migrate.ts` and `state-io.ts` | high | mitigate | each sabotage restored with `git checkout`; `git diff --stat 7e961d04..HEAD -- extensions test` is empty | closed |
| T-07-03 | Information disclosure | test runs against the real `~/.pi` | medium | mitigate | `find ~/.pi -newer <marker>` printed nothing after the gate | closed |
| T-07-04 | Repudiation | red-proof evidence | low | mitigate | logs and exit codes under the worktree's `tmp/p7-red/`; table in 07-01-SUMMARY.md | closed |
| T-07-05 | Denial of service | the ST-4 fire-and-forget migration write | low | accept | a late write fails a scenario red, never green; never observed in 9 clean runs and the gate | accepted |
| T-07-SC | Tampering | package installs | high | mitigate | no change to `package.json` or `package-lock.json` | closed |

---

## Accepted Risks

| Risk | Rationale |
|------|-----------|
| T-07-05 | The await fix (D-BG-704) applies only after a twice-observed failure, which never occurred. |

---

## Audit Trail

- 2026-11-08: all threats verified at `8dc9e0d9`; `threats_open: 0`.
