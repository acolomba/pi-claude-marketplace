# Phase 8 (First-Run Config Migration): Dubious Choices

The choices Phase 8 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 8.
Only the phase's session writes this file: it copies each item from the report
of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 8's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-801 to D-BG-808 in 08-CONTEXT.md. The entries below are the ones a reviewer may want to reverse.

- **P8-DC-01 (Medium, open). D-BG-802: a rebuilt config leaves out cascade-installed dependencies.** CFGMIG-01 says the config declares "every recorded marketplace and plugin". D-04-02 (v1.20) rules that the config names only the plugins the user asked for, and the uninstall orphan sweep treats a declared dependency as the user's desired state, which the next load reinstalls. The rebuild therefore leaves out a `provenance: "dependency"` record, except one the user disabled by name, which keeps the `{ "enabled": false }` entry `disable` wrote. A 0.4.3 state has no dependency records, so the upgrade path still declares every record.
- **P8-DC-02 (Low, open). D-BG-806: a new session stands in for a later load.** Pi runs the same `resources_discover` load on a session start and on `/reload`, and the suite already uses a new session for `/reload` (`features/agent/lifecycle.feature`). The planner adds one terminal `/reload` scenario only if the existing steps support it without a frozen-file change.
- **P8-DC-03 (Low, open). D-BG-804: a deleted config loses `autoupdate`.** Under a current release, `state.json` no longer records a marketplace's `autoupdate` (D-13), so a config the user deletes comes back without it. Only a release-0.4.3 record carries the field the rebuild copies.

## Research step

- **P8-DC-04 (Medium, open). The edit scenario writes the user's edit through the plugins step, not `with this text:`.** D-BG-805 named `a config ... with this text:`, but that step writes its doc string raw, with no `{home}` expansion, and the user-scope config must name the marketplace by its absolute sandbox path. The scenario uses `a config in scope user and layer base, with these plugins:` with the byte snapshot steps (`... bytes ... are remembered` / `are unchanged`), and its red proof still fails as it should.
- **P8-DC-05 (Low, open). The invalid-config scenarios pin an empty file's `Unexpected end of JSON input`, or a one-segment schema error such as `{ "plugins": [] }`.** D-BG-807's example schema error `/plugins/demo@fixtures/enabled: must be boolean` reaches the user as `demo@fixtures/enabled: must be boolean`, because `shared/redact-absolute-paths.ts` reads the JSON pointer as an absolute path. That redaction is outside this phase's files: parent note.
- **P8-DC-06 (Low, open). Node 24's JSON error text was not observed.** Node 22.22.2 and 26.13.0 give identical messages; Node 24 is not installed and fetching it was refused. The existing unit test `test/persistence/config-io.test.ts` pins `Unexpected end of JSON input` and passes on CI's Node 24.
- **P8-DC-07 (Low, open). `migrate-config.ts` is not added to `DISABLED_STATE_TARGETS`.** No gate requires it, and registering it would edit `test/architecture/gate-targets.ts` and the disabled-state test's `DECLARED_MODULE_ORDER`, which this phase does not own.
- **P8-DC-08 (Low, open). A load with autoapply on can still rewrite the config in one case.** A declared install of a `defaultEnabled: false` plugin stamps `{ "enabled": false }` and re-serializes the file (D-102-02 / DFEN-04). That is a recorded decision in the install path, which this phase does not own: parent note, no fix.
- **P8-DC-09 (Low, open). Project 0.4.3 `autoupdate` setup.** To pin `false`, a scenario turns autoupdate on and then off, because a bare `noautoupdate` writes nothing to the config.
- **P8-DC-10 (Low, open). The project-scope `pending` scenario uses a deleted config with a disabled plugin** rather than the 0.4.3 upgrade, so its red proof is simply the unfixed rebuild.
