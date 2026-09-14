---
phase: 01-reliable-negative-controls
plan: 02
status: complete
requirements_completed: [HIST-01]
---

# Backlog history reconciliation

E2EIMP-01 is stale: `env -u PI_CODING_AGENT_DIR node tests/e2e/import-command.test.ts`
passed 3/3 on Node v26.8.2. The current assertions already use folded marketplace
output, so no assertion was changed.

TESTQ-01 and FLOW-07 retain their closed state. FLOW-07 links now target the
refine-unit-tests archive, where GGAT-03 is checked and Phase 7 verification
records `passed`, 7/7. TESTQ-01's inferred requirement mapping stays explicitly
identified as inferred. The archived milestone audit says `tech_debt`; this
reconciliation does not rewrite it as an unqualified clean audit.

COV-01's header now agrees with its existing superseded disposition under
RCOV-04. Both named orchestrators remain measured and outside the direct-pair
pin. No exclusions were added. Aggregate unit coverage is measured separately.

FLOW-09 now labels its explicit seam work closed and its ordinary-export and
production-mode work open. A fresh Fallow 3.22.0 production probe reproduces
111 findings (93 exports, 12 types, one file, one member, four duplicate groups),
which Phase 5 will triage individually.

Review: only status, evidence, and stale archive links changed; original reports
and archived milestone files remain intact.
