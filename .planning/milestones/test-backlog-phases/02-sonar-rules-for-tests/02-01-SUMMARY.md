---
phase: 02-sonar-rules-for-tests
plan: 01
subsystem: testing
status: complete
requirements-completed: [SONAR-01, SONAR-02]
key-files:
  created:
    - tests/architecture/sonar-test-rules.test.ts
  modified:
    - eslint.config.js
    - tests/domain/device-flow-contract.ts
    - tests/platform/credential-ops-contract.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - .planning/codebase/CONVENTIONS.md
completed: 2026-09-14
---

# Sonar test assertion policy

Enabled `assertions-in-tests`, `no-empty-test-file`, and
`no-trivial-assertions` at error for tests. Seven exact compiler-only owners
are exempt only from the empty-file rule. Five explained call-site exceptions
preserve assertions in selected contract callbacks and explicit strict-mock
verification. The standalone enable overload test retains its compiler proof
and now asserts the complete runtime outcome and notification.

Thirteen real-config architecture cases prove each rule rejects a planted
offender and permits a real assertion, distinguish a disabled rule, and
prove each precise compiler-only exception changes the empty-file result.
The complete recommended-rule scan covered 354 files and reported 1,083
findings. `02-SONAR-POLICY.md` records all 23 finding clusters plus adoption
of the zero-finding trivial-assertion rule. No remaining cluster established
a defect requiring an assertion to be removed or weakened.

Verification: full ESLint and typecheck passed; new controls 13/13 passed;
complete unit run 6,016/6,016 passed, with exact 100% aggregate production
coverage after the independent Phase 3 baseline correction. No coverage
threshold or production exclusion changed. Logs are in
`/tmp/test-backlog-sonar-{controls,typecheck,full-lint}.log` and
`/tmp/test-backlog-unit-restored.log`.
