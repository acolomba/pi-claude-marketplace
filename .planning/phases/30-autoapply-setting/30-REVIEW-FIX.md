---
phase: 30-autoapply-setting
round: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report (round 1)

| ID | Severity | Disposition | Fix |
| --- | --- | --- | --- |
| CR-01 | Critical | fixed | `auth-host.ts::buildAuthForHost` returns the stored-credential bundle for a run no command opened, so an autoapply load never starts the GitHub Device Flow; a credential miss fails the row. Unit test `AAP-02 / D-13` in `test/orchestrators/auth-host.test.ts`. Recorded as CONTEXT D-13. No scenario: the cucumber git host reaches GitHub sources through `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, which always uses stored credentials, so the suite has no Device Flow stand-in. |
| WR-01 | Warning | fixed | The non-boolean scenario now has a project base `true` beside the invalid local file (catches "skip invalid files"); a new scenario has a project local `true` override a user `false` (catches "off if any file says false"). Both failed against the matching wrong implementation, then passed. |
| WR-02 | Warning | fixed | `load.ts` catches a throw from the apply step, reports `reconcile-aborted`, then runs the read-only pass (routing rebuild, warnings, pending block). Unit test `AAP-03 / NFR-2` in `test/orchestrators/reconcile/load.test.ts`. |
| IN-01 | Info | fixed | `apply.ts` header and snapshot comment, `types.ts` `ApplyReconcileOptions.run` doc name the autoapply load. |
| IN-02 | Info | fixed | `load.ts` header says the apply report replaces the pending block. |
| IN-03 | Info | fixed | The load-origin runs in `apply.test.ts` and `auth-host.test.ts` drop the seed's command state. |
| IN-04 | Info | fixed | README.md / README.es.md say a user config cannot turn off a project's `autoapply` and that the project local config can; they also say a load never asks you to sign in. |

Also fixed while running `npm run check`: `test/integration/mcp-migration.test.ts` drove the apply step with a load-origin run and expected the `Apply: nothing to change.` advisory, which an autoapply load no longer sends. The helper now opens a command run.
