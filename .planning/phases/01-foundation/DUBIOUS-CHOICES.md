# Phase 1 (Foundation): Dubious Choices

The choices Phase 1 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 1.
Only the parent session writes this file: it copies each item from the report
of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 1's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-01 to D-BG-16 in 01-CONTEXT.md and PROJECT.md, so they are not repeated here.

## Research step

- **P1-DC-01 (Low, open). D-BG-10 premise.** CONTEXT says nothing else reacts to `PI_SUBAGENT_CHILD`, but pi-subagents does (it registers nothing). The decision still holds, because a real child's pi-subagents is inert too; only its rationale text is wrong.
- **P1-DC-02 (Medium, open). D-BG-03 certificate.** "The same certificate approach as https-git-host" was read as reusing the git host's key and certificate, because Pi trusts only one CA file.
- **P1-DC-03 (Low, open). Plan split.** The launch plumbing moved from the roadmap's Wave 2 "Terminal and process" plan to Wave 1.
- **P1-DC-04 (Medium, open). D-BG-13 and CFGMIG-01.** A true pre-config state (v0.4.3) cannot carry `enabled: false`. Covering the enabled state needs a current-schema state with its config deleted, which is not an earlier-release shape.
- **P1-DC-05 (Medium, open). Additions beyond the Builds list.** `PiProcess.crash()` (ASYNC-04), the tool-validation upstream projector (TOOL-03), and terminal launch options for the redirect (DFLOW-04) were added to Phase 1, because the streams that need them cannot edit frozen files.
- **P1-DC-06 (Low, open). D-BG-07 mechanism.** The usage option wraps `streamSimple`, because the faux provider overwrites usage; the compaction seed also uses the `keepRecentTokens: 1` Given.

## Planning step

- **P1-DC-07 (Low, open). Plan count and grouping.** Eight plans. The picker, json run, and terminal run share 01-07 (about 95k tokens) because all three edit `pi-tui.ts`; the stale-lock seed sits in 01-02.
- **P1-DC-08 (Medium, open). World API fixed before its users.** `withoutGitHubBaseOverride`, `subagentChild`, `crashPi`, `restartPi("after-crash")`, and `oneShotPiLaunch()` are fixed in Wave 1; a Wave 2 plan that finds them short must edit `world.ts` as a recorded deviation.
- **P1-DC-09 (Medium, open). Async hook lifecycle design.** Only hooks with `async`, `async rewake`, or `waits` write start and end lines and a pid file; the release wait is capped at 60 s; the shared release step needs a declared rewake summary, so a plain-`async` hook (ASYNC-05) needs its own step in Phase 2.
- **P1-DC-10 (Medium, open). ASYNC-04 pinned early.** The crash and reload seeds pin ASYNC-04's reap inside Phase 1, so a product reap bug would surface in Phase 1 in files Phase 2 owns.
- **P1-DC-11 (Medium, open). TOOL-03 projector form.** Phase 1 chose `invalid arguments: <paths>`, and its seed pins TOOL-03-shaped behavior early.
- **P1-DC-12 (Low, open). Device Flow additions.** A terminal-routing seed, the credential-store Given, and the canonical `verification_uri` that nothing fetches were added beyond the Builds list.
- **P1-DC-13 (Medium, open). Per-phase D-BG ID blocks.** Phase N numbers its decisions D-BG-N01 to D-BG-N99 instead of continuing one sequence (D-BG-15 says "continue"), so fifteen parallel children cannot collide.
- **P1-DC-14 (Low, open). PROJECT.md goal wording.** The milestone goal in PROJECT.md is also corrected under D-BG-04, and D-BG-01 to D-BG-16 get Key Decisions rows marked Pending.
- **P1-DC-15 (Low, open). CI time measured locally.** Nothing is pushed (D-BG-16), so the CI legs are timed locally against run 42421611502; a local machine faster than CI understates the margin.
- **P1-DC-16 (Medium, open). Branch timing.** 01-08 creates the fifteen branches at its own head, before the parent's review and close-out commits; each child merges the local `features/behavioral-gaps` first to pick those up.
- **P1-DC-17 (Low, open). Structure choices.** A new topic module `plugin/picker.steps.ts`; the screen model lives in `pi-tui.ts` with tests in `test/architecture/`; the json driver keeps its own path to the scripted model; two background-child mechanisms coexist.
- **P1-DC-18 (Low, open). Legacy-move seed.** It may split into an `@adapter-only`/`@builtin-only` pair, because Pi's built-in MCP reads the same user-scope `mcp.json`.
- **P1-DC-19 (Low, open). `platform/pi-api.ts` verify-only.** Every event type the streams read is already re-exported, so 01-08 rewords the roadmap's "Phase 1 widens" line instead of editing the file.
- **P1-DC-20 (Medium, open). Plan-checker fixes applied by the parent.** The parent, not the planner, marked the research questions resolved, added a `/reload` seed for ASYNC-04 to 01-05, made 01-08 check that it is on `features/behavioral-gaps` before creating branches, and listed `ci.yml` in 01-08's files.

## Execution

- **P1-DC-21 (Low, open). Seeded-file wording.** layout.md says Phases 4 and 6 create `hook/tool-failure.feature` and `hook/session-end.feature`, because no Phase 1 plan seeds them (01-01).
- **P1-DC-22 (Low, open). Phase log ID wording.** The log names its IDs `P{N}-DC-NN` with N = 1, so 01-01's grep criterion holds (01-01).
- **P1-DC-23 (Medium, open). Key Decisions rationale cells.** CONTEXT gives no explicit rationale for D-BG-02, 03, 05 to 08, and 10 to 15; the executor wrote those cells from the decision text and the roadmap. The user may want to reword them (01-01).
- **P1-DC-24 (Low, open). D-BG-09 row.** The row records that Pi 1.5.0 has a json mode, so BOOT-01 keeps its json clause; this comes from the plan's must-haves, not CONTEXT (01-01).
- **P1-DC-25 (Low, open). Layout section extras.** The REQUIREMENTS footer was replaced, the layout section repeats the roadmap's path-root sentences, and reserved names are one full path per line (01-01).
- **P1-DC-26 (Medium, open). Frozen export exemption.** `.fallowrc.json` gained an `ignoreExports` entry for `claudePluginPayloads` in `features/lib/pi-commands.ts`, which has no consumer until 01-07; 01-07 must remove it, since fallow never reports a stale entry (01-02).
- **P1-DC-27 (Low, open). Child step location.** The background-child step lives in `companion.steps.ts`, while its no-companion twin is in `model.steps.ts` (01-02).
- **P1-DC-28 (Low, open). Terminal carry-over.** Only a `withoutGitHubBaseOverride` profile passes its environment and extensions to the terminal session; a normal restart after `crashPi()` is not refused (01-02).
- **P1-DC-29 (Low, open). Seed details.** The child Given follows the config setup, the MLOCK-02 seed installs no plugin, the stale-lock second red proof also removed the fixture check, and `oneShotPiLaunch()` returns a named `OneShotPiLaunch` type (01-02).
- **P1-DC-30 (Low, open). Context tokens stripped from every event.** The scripted model's `context tokens` field is removed from partial and error events too, not only `done`, because Pi's loop keeps partial messages in context (01-03).
- **P1-DC-31 (Medium, open). TOOL-01 installs a plugin.** The TOOL-01 seed installs `demo@fixtures`, beyond the plan's marketplace add, so the plugin count is not trivially 0 (01-03).
- **P1-DC-32 (Medium, open). PCOMP-01 pins Pi's summary frame.** The `compact summary` cell includes Pi's own frame text around `Summary A.`, as the manual-compaction scenario does; a Pi rewording breaks both, and Phase 5 may want a projection (01-03).
- **P1-DC-33 (Low, open). Projector recognition and parser wording.** The argument-validation projector matches a first line naming the tool in quotes and ending with `:`, sorts the paths, and leaves Pi's other refusals unprojected; the script parser's refusal messages were reworded and `context tokens` takes only a positive integer (01-03).
- **P1-DC-34 (High, open). Deleted-config seed pins a product gap.** Rebuilding a deleted config writes every plugin as `{}`, so a disabled plugin loses `enabled: false` and the next load reports `will enable`. The seed states today's output; the parent accepted the route and added the fix to Phase 8's criterion 1 (CFGMIG-01), which owns `migrate-config.ts` (01-04).
- **P1-DC-35 (Medium, open). CFGMIG-01 enabled state from a current-schema record.** Per DC-D, the enabled state is covered by a current-schema record whose config the user deleted, because no release before the config files wrote `enabled` (01-04).
- **P1-DC-36 (Low, open). 0.4.3 autoupdate left absent.** The 0.4.3 marketplace record omits `autoupdate` when the base config declares none, because 0.4.3's `marketplace add` never wrote it (01-04).
- **P1-DC-37 (Low, open). Writer scope.** The earlier-release writers reproduce only path sources and throw on other kinds; 0.19.2 `hookEntries` are kept as is; legacy `mcp.json` entries are rebuilt from the plugin's `.mcp.json` as 0.19.2 did, importing nothing from the product (01-04).
- **P1-DC-38 (Low, open). 0.4.3 red proof.** The planned red proof did not fail (bytes identical); a product-side proof with the config save turned off was used instead, and the seed's Given asserts both configs are absent (01-04).
- **P1-DC-39 (Low, open). Fifth writing config step.** The new deletion step breaks the steps.md rule of four writing config steps; the parent added it to `steps.md` as a fifth exception (01-04).
- **P1-DC-40 (High, open). Crash seed in the user scope.** The next start after a Pi crash does not stop a project-scope install's orphaned async hooks (the bridge registers with `cwd: homedir()`, and the project hydrate never reaps). The seed installs in the user scope so the gate stays green; the parent carried the fix and the project-scope scenario to Phase 2's ASYNC-04 criterion (01-05).
- **P1-DC-41 (Medium, open). Reload seed starts its hook on SessionStart.** The `/reload` seed starts the waiting hook on SessionStart `startup`, not on a terminal prompt, because the reload step's own prompt would start a new waiting hook (01-05).
- **P1-DC-42 (Low, open). Release step limits.** The shared release steps wait for a rewake summary and read the profile Pi's records, so Phase 2 must add its own steps for a plain-async or terminal-started hook (01-05).
- **P1-DC-43 (Low, open). Lifecycle details.** The end line comes from an EXIT trap (a signal-killed script logs none); `no hook process is running` fails when no pid file exists; the rewake-summaries step compares whole payloads; `once` now shares a `parseBoolean` (01-05).
