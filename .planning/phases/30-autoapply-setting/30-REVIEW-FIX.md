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

# Round 2

| ID | Severity | Disposition | Fix |
| --- | --- | --- | --- |
| WR-01 | Warning | accepted, open | An apply step that throws mid-pass (GHB-03, an invalid `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`) discards the rows it collected, and a one-time MCP migration notice that committed before the throw is not shown again. `/claude:plugin apply` loses the same rows on the same throw today, so the load matches the command. Reporting the collected rows before rethrowing changes the command's GHB-03 output too, so it is left for a follow-up and reported to the user. |
| IN-01 | Info | fixed | The abort notice in `load.ts` is wrapped: a refused notify is debug-logged and the read-only pass still runs. Unit test `AAP-03 / NFR-2: a refused abort notice still lets the read-only pass run`. |

Round 3 was not needed for the fixed items; WR-01 stays open by decision above.

# Command review (30-REVIEW-02.md, one round)

| ID | Severity | Disposition | Fix |
| --- | --- | --- | --- |
| CR-01 | Critical | fixed | A set now loads all four configs under the scope lock and writes nothing when any is invalid, so a base write beside an invalid local config no longer creates the base config that would stop the MIG-01 migration. Unit test `AAP-04 / MIG-01: set into an absent base config beside an invalid local config writes nothing`. |
| WR-01 | Warning | fixed | Same change: a set fails closed without writing when another config is invalid; the unit test that locked in the old write now asserts no file. |
| WR-02 | Warning | fixed in part | New scenario "Autoapply on writes nothing while another config is invalid ...". The MIG-01-before-write step has no scenario: the suite cannot record plugins without the install writing the base config. A unit test covers it. |
| WR-03 | Warning | fixed | A state.json that cannot be read is a row named `state.json` with its closed-set reason (`{unparseable}` / `{unreadable}`); a local write reads no state; a failed write is `{unreadable}` instead of `{source missing}`. |
| IN-01, IN-02, IN-08 | Info | fixed | Comments in `config-io.ts`, the step module and the handler. |
| IN-03 | Info | fixed | `json-output-docs.test.ts` lists `autoapply-status` among the outcome kinds. |
| IN-04 | Info | fixed | The `jq -c` example is compact again; the `files` row describes the set form. |
| IN-05 | Info | kept | The file list is user base first, as the user listed the four files. |
| IN-06 | Info | kept | Style only. |
| IN-07 | Info | fixed | Scenario "Autoapply on changes the setting and installs nothing until the next load". |
