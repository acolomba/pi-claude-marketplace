# Requirements: test-backlog

Started 2026-09-14 on `features/test-backlog`.

## Constraints

- Preserve the current 100% aggregate unit coverage baseline and assertion strength.
- Do not lower thresholds, exclude production code, or create test-only production exports.
- Unit/Sonar aggregate coverage and the existing direct-pair pin are distinct measurements.
- Keep this branch and preserve archived milestones and unrelated local edits.
- All items in the user handoff are in scope; prior scope exclusions are historical.

## Requirements

- [x] **NEG-01**: Repair the direct-coverage CLI negative controls on Node 26 without weakening exit or diagnostic assertions.
- [x] **NEG-02**: Determine the child-observation cause and check analogous subprocess assertions, retaining launch-error discrimination.
- [x] **HIST-01**: Reconfirm E2EIMP-01 and reconcile TESTQ-01, FLOW-07, and COV-01 without duplicate implementation.
- [x] **SONAR-01**: Enable assertions-in-tests, no-empty-test-file, and no-trivial-assertions with deliberate type-only and helper controls.
- [x] **SONAR-02**: Measure and disposition the remaining SWTEST-01 rule clusters instead of enabling the preset wholesale.
- [x] **AGENT-01**: Test collisions through real discovery/staging and preserve distinct Claude source names and migrate owned generated names under the approved collision contract.
- [x] **AGENT-02**: Align AG-12, RN-6, duplicate warnings, comments, and collision tests with reachable production behavior.
- [x] **ARGS-01**: Reject unknown flags and surplus positionals across the live command inventory before dispatch.
- [x] **ARGS-02**: Resolve and enforce --local semantics for marketplace info/list/update with accurate usage.
- [x] **ARGS-03**: Extend the flag catalog and discriminating drift gate to marketplace verbs.
- [x] **EXPORT-01**: Triage all current Fallow production findings; remove ordinary test-only exports through coherent ownership and public tests.
- [x] **EXPORT-02**: Enable and validate Fallow production mode while retaining completed explicit-seam protections.
- [x] **MEMBER-01**: Add a static gate that detects unused interface/type members, including an unread optional EdgeDeps member.
- [x] **MEMBER-02**: Validate read-site analysis with offender and benign controls and document justified external/structural contracts.
- [x] **METRIC-01**: Reliably convert current unit coverage to Fallow-compatible Istanbul JSON and verify measurement fidelity.
- [x] **METRIC-02**: Select and validate a CRAP metric policy using real measurements and negative controls.
- [ ] **FINAL-01**: Preserve 100% aggregate unit production coverage, assertion strength, direct-pair requirements, and all required quality checks.
- [ ] **FINAL-02**: Account for all authorized backlog/todo items with implementation evidence or a current user-agreed disposition.

## Traceability

| Requirement | Phase | Status |
| --- | --- | --- |
| NEG-01 | 1 | Complete |
| NEG-02 | 1 | Complete |
| HIST-01 | 1 | Complete |
| SONAR-01 | 2 | Complete |
| SONAR-02 | 2 | Complete |
| AGENT-01 | 3 | Complete |
| AGENT-02 | 3 | Complete |
| ARGS-01 | 4 | Complete |
| ARGS-02 | 4 | Complete |
| ARGS-03 | 4 | Complete |
| EXPORT-01 | 5 | Complete |
| EXPORT-02 | 5 | Complete |
| MEMBER-01 | 6 | Complete |
| MEMBER-02 | 6 | Complete |
| METRIC-01 | 7 | Complete |
| METRIC-02 | 7 | Complete |
| FINAL-01 | 8 | Pending |
| FINAL-02 | 8 | Pending |
