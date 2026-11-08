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

## Planning step

- **P8-DC-11 (Low, open). Two plans in sequence, split by requirement** (08-01 CFGMIG-01, 08-02 CFGMIG-02); they cannot share a wave because both edit the feature file.
- **P8-DC-12 (Low, open). The feature's Background keeps only the publish step;** every scenario states its own plugin offer and marketplace add, so the project scenarios do not inherit a user-scope add they never use.
- **P8-DC-13 (Medium, open). An extra scenario S-P5, which research did not plan:** a project scope with one marketplace in the local config and one in the base config gets a rebuilt base config with only the base one. Without it, an implementation that skips the migration whenever a local config exists would still pass S-P3. It deletes both configs and rewrites the local one with existing steps instead of adding a step module.
- **P8-DC-14 (Low, open). S-U5 kept:** a dependency the user disabled stays declared `enabled: false` (the D-BG-802 exception is user-visible).
- **P8-DC-15 (Low, open). The project 0.4.3 scenario pins `autoupdate` false;** the user seed pins true.
- **P8-DC-16 (Low, open). The unit cases are one data-driven loop of five rows** to avoid a fallow clone group; the fifth row (a dependency the check holds down is left out) is not named in CONTEXT.
- **P8-DC-17 (Low, open). No scenario runs `pending` against an invalid config;** the load prints the block `composePendingReport` builds, so D-BG-807's "pending reports the same block" is taken as covered.
- **P8-DC-18 (Low, open). The tracer task bundles the fix, unit rows, seed rewrite, and README line in one commit,** because the commit hook checks 100% direct coverage of the staged pair.
- **P8-DC-19 (Low, open). Every decision rated reversible; no checkpoint task,** because the run must not stop.
- **P8-DC-20 (Low, open). The planner edited ROADMAP.md's Phase 8 `Plans` entry itself.**

## Execution step

- **P8-DC-21 (Medium, open). Execution, code review, fixes, and verification ran inline in the phase session, not in subagents.** The coordinator ordered it mid-phase: this session's Agent tool has no foreground mode, and a background subagent stalls when the session's turn ends. The 08-01 executor was stopped after it had rewritten the seed and measured its red run (nothing committed); the session finished 08-01 and ran 08-02, the review, and the verification itself, following `execute-plan.md`, `.claude/agents/gsd-code-reviewer.md`, and `.claude/agents/gsd-verifier.md`. The research, pattern-mapping, planning, and plan-check steps did run in subagents.
- **P8-DC-22 (Low, open). The dispatch-isolation sentinel was forced in the parent checkout's `.gsd/`.** The GSD isolation guard hook reads the sentinel from the session's cwd, which is the parent checkout `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps`, not this phase's worktree, so the 08-01 executor dispatch was refused until `dispatch-isolation --force-isolation none --phase 08 --plan 08-01` ran there. That writes only the gitignored runtime file `.gsd/dispatch-isolation-sentinel.json`, which other phases' sessions also write (it held a Phase 10 record before).
- **P8-DC-23 (Low, open). Executor prompts passed the execution-context workflow files by path** (the executor read them) instead of inlining them verbatim, and the sequential root pin as a script file under the phase scratch dir.
- **P8-DC-24 (Low, open). Planning commits used the shared scratchpad for message files** before the coordinator's scratch-dir rule; their titles were checked against their contents and match.
