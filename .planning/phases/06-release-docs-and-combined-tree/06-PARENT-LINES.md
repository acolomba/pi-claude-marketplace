# Phase 6: Parent Lines Inventory

Each section below is copied verbatim from the `## Parent lines` section of a phase SUMMARY on the combined tree (merge a25cd35). Phase 6 applies each line, or records why it moves to BACKLOG.md, in its plans. The parent's own notes from child messages follow at the end.

## From `01-foundation-and-pi-1-5-0/01-14-SUMMARY.md`


Lines for files a child phase may not edit, for the parent to apply at merge
or in Phase 6:

- **Frozen files.** The gate needed no frozen-file change. One optional
  cleanup: the `.fallowrc.json` `ignoreExports` entry for
  `features/lib/mcp-implementation.ts` (`stubPidsIn`,
  `waitUntilProcessesExit`, `writeAdapterOnboardingSeed`) is already
  redundant, since `features/support/pi-process.ts` uses all three
  (P1-DC-33). Remove it at any merge, or in Phase 6.
- **Phase 6, fallow.** Remove the `entry` lines for
  `domain/mcp-implementation.ts` and `orchestrators/mcp/recorded-servers.ts`
  and every `ignoreExports` entry listed in `01-FROZEN.md` section 3 once the
  combined tree consumes those exports. Then update the entry list in
  CONVENTIONS.md, STACK.md, and ARCHITECTURE.md.
- **Phase 6, closed sets.** Remove any of the six entries (`requires mcp`,
  `requires builtin mcp`, `overridden by mcp.json`, `project not trusted`,
  companions `mcp` and `builtin mcp`) that no phase emits on the combined
  tree, and fix the lock counts, `docs/json-output.md`, and the schema.
- **Phase 6, snapshot.** `SoftDepStatus.piMcpAdapterLoaded` is a derived view
  of `mcpImplementation`; remove it once nothing reads it (01-05 SUMMARY).
- **CHANGELOG.md.** At PR time, consolidate the Phase 1 "Pi 1.5.0" bullet
  under Unreleased with the milestone's built-in MCP bullet, and add the PR
  number (P1-DC-27).
- **README.md and README.es.md.** The built-in MCP text for MDOC-02 (Phase 6):
  Pi's built-in MCP serves plugin MCP servers without pi-mcp-adapter, and the
  adapter still wins when both are loaded.
- **PROJECT.md.** Resolve the D-MB-08..D-MB-13 rows marked `-- Pending` with
  the user (P1-DC-25). Amend the D-CF1-16 row after the CI run, with the text
  in `01-CI-HANDOFF.md`.
- **BACKLOG.md** (from CONTEXT's Deferred Ideas):
  - MCPV2-01: register and unregister built-in servers at once on install,
    uninstall, enable, and disable, not only at `session_start` and after the
    load reconcile.
  - MCPV2-02: map Claude deny rules to Pi's `toolExposure: "hidden"`.
  - MCPV2-03: let background pi-subagents children call plugin MCP tools
    under built-in MCP.
  - If Phase 3 does not settle them: what `info`'s `requires:` line shows
    while an implementation runs every server, and the load warning row for a
    plugin that becomes partial after a switch.
  - If Phase 2 does not settle them: whether a built-in server's status can
    tell `not loaded` from `not connected`, and how the first built-in session
    reports a legacy `mcp.json` entry.
- **ARCHITECTURE.md and STRUCTURE.md.** Refresh for the new
  `orchestrators/mcp/` directory (`session-materialize.ts`,
  `recorded-servers.ts`, `builtin-registration-step.ts`,
  `agent-grants-step.ts`), the new domain modules (`mcp-implementation.ts`,
  `mcp-builtin-features.ts`), and `platform/mcp-builtin-status.ts` (Phase 6,
  or `/gsd-map-codebase`).
- **CI.** Phase 6 re-measures the behavioral legs on the combined tree,
  because Phases 2-5 add 60-100 MCP scenarios.
- **Root DUBIOUS-CHOICES.md.** Phase 6 merges P1-DC-01..P1-DC-37 and the
  P1-14-DC entries below into the root log.


## From `02-built-in-materialization/02-01-SUMMARY.md`


- `test/architecture/manifest-read-agreement.test.ts` (unowned): its header asks every new plugin manifest reader to join the gate (MANF-01). `bridges/mcp/builtin-description.ts` reads `MANIFEST_CANDIDATES` through `locateManifestCandidate`, so it should be added to that gate.
- `test/integration/adapter-expansion-conformance.test.ts` (unowned): pass `ADAPTER_FIELD_ENCODER` at its two `substituteAndInject` calls. Then the encoder parameter can become required and lose its default (P2-DC-19 as planned).
- `features/lib/upstream/`: the tool_search projection in `features/lib/mcp-builtin-tool-search.ts` should move there in Phase 6 (P2-DC-18).
- `.fallowrc.json` (frozen): `orchestrators/mcp/recorded-servers.ts` now has a production consumer, so its `entry` and `ignoreExports` items can go in Phase 6 (RESEARCH Q7).
- `.planning/codebase/CONVENTIONS.md`: no new fallow marker was added. The step test and the registration test add three reasoned `@typescript-eslint/unbound-method` disables, which follow the strong-mock precedent.


## From `02-built-in-materialization/02-02-SUMMARY.md`


None. No frozen or parent-owned file needed a change.


## From `02-built-in-materialization/02-03-SUMMARY.md`


- `.planning/codebase/CONVENTIONS.md` (Suppressions): the count goes from 44 to 45. Seven `unused-export` markers now cover default exports that a loader reads by name. The harness Pi extensions loaded by Pi's `--extension` loader are now five; add `features/lib/mcp-builtin-config-probe/extension.ts`.
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` (frozen): optionally name the config probe beside the registry probe, as the extension a built-in values scenario loads through `extraExtensions` (P2-DC-24).
- None for the bundle scenario. It is `@mcp`, and its description now says that neither MCP implementation has a bundle runner.


## From `02-built-in-materialization/02-04-SUMMARY.md`


- `features/mcp-server/companion-missing.feature` line 76 (Phase 3, `@builtin-only` scenario `Plugin info names pi-mcp-adapter as a missing companion`): `"status":"status unknown"` becomes `"status":"not loaded"` in the `plugin components mcp` cell, with the table realigned.
- `test/orchestrators/plugin/info.test.ts` (shared, P2-DC-31): in the MSEL-01 `builtin` case, the built-in reader snapshot names `plugin_alpha_srv` instead of `plugin_alpha_srv_` (`builtin: statusSnapshot([{ name: "plugin_alpha_srv", status: "failed" }])`). This plan changed that one line; keep it when the read-time verdicts merge.


## From `02-built-in-materialization/02-05-SUMMARY.md`


- `features/mcp-server/project-scope.feature` description points to `builtin-status.feature` for the untrusted info row. That file belongs to plan 02-04 and was not on this branch when this plan ran. If 02-04 names the file differently, update the description.


## From `02-built-in-materialization/02-06-SUMMARY.md`


- `features/support/world.ts` / `features/lib/turn-records.ts` (frozen harness): `assertStandInsStopped` runs at once after `pi.stop()`. A stand-in that Pi lost track of exits only when its stdin closes, a moment after Pi exits. Either poll briefly, for example up to the listing poll interval times a few, before the check fails, or make `startSession` (`features/lib/pi-commands.ts`) avoid the RPC double bind. Then lift `A new session offers the plugin's tool again (BLT-01)` in `features/mcp-server/lifecycle.feature` from `@adapter-only` to `@mcp`, and close the matching WINDOWS.md entry.
- Upstream Pi (report, not a repo edit): RPC `new_session` emits `session_start` twice (`modes/rpc/rpc-mode.js`, with `AgentSessionRuntime.finishSessionReplacement`), and the built-in MCP `session_start` handler does not close the connections of an earlier `session_start` in the same runtime.
- `.planning/phases/02-built-in-materialization/02-06-PLAN.md` flagged assumption 2 says "the scenarios hold either way". That is false for Pi's built-in MCP when a server stays registered across `new_session`.


## From `02-built-in-materialization/02-07-SUMMARY.md`


None. No frozen or parent-owned file needed a change.


## From `02-built-in-materialization/02-08-SUMMARY.md`


Each line names the file, the change, and the evidence. Items 1-9 come from the plan; items 10-20 are the Wave 1 and Wave 2 SUMMARYs' parent lines and unowned-file notes.

1. **`CHANGELOG.md`** (`## [Unreleased]`), one bullet per the changelog skill: "Plugin MCP servers now run through Pi's built-in MCP when pi-mcp-adapter is absent, at each start and `/reload`, only in projects that Pi trusts, with their status in `info`. Switching needs no plugin command." Evidence: BLT-01..06, MSEL-02 scenarios above.
2. **`README.md` line 29** (`- MCP servers. Requires [pi-mcp-adapter]...`): name either pi-mcp-adapter or Pi's built-in MCP, add that Pi's built-in MCP runs project servers only in a trusted project and picks up plugin changes at `/reload`. **Line 40** (pi-mcp-adapter "optional but recommended"): say it is optional because Pi's built-in MCP runs plugin servers without it. **Line 126**: add the built-in name `plugin_<plugin>_<server>` beside the adapter key. **Line 144**: "a feature that pi-mcp-adapter cannot run" becomes "a feature that the active MCP implementation cannot run". **`README.es.md`**: the same four lines (29, 40, 126, 144). Evidence: `docs/mcp-compatibility.md` "Choosing an implementation".
3. **`.planning/PROJECT.md` Key Decisions**, one row each: P2-DC-02 (built-in values resolved by the extension at registration, visible to every extension in the process; amends D-MB-04); P2-DC-08 (`mcp.json` overrides and refused registrations reported in `info` only, no load notice); P2-DC-10 (built-in status inferred from Pi's tool list); P2-DC-13 (containment root: the marketplace root or the plugin clones directory); P2-DC-14 (the project record wins per server name); P2-DC-05 (`timeout` as ms / 1000, no rounding); P2-DC-04 (no `cwd` written); P2-DC-20 (`callbackUrl` only with `callbackPort`).
4. **`.planning/BACKLOG.md`**: (a) move the `tool_search` projection (`features/lib/mcp-builtin-tool-search.ts` and the step in `features/step_definitions/mcp-server/builtin-tool-search.steps.ts`) into `features/lib/upstream/` (P2-DC-18); (b) re-pin the AVAR-05 deny-lists to Claude Code 2.1.318 (P2-DC-22); (c) a load-time notice for an overridden or refused built-in registration (deferred, P2-DC-08); (d) a fallback when `tool_search` is off (deferred); (e) info that tells a plugin server whose name another extension registered first from this extension's own registration, which needs this extension's own `extensionPath` and so a change to the frozen `createBuiltinMcpStatusReader` parameter (P2-DC-46).
5. **`docs/output-catalog.md`**: beside the adapter status mapping table (lines 3044-3056), add the built-in mapping: `connected` (a namespace tool not hidden), `disabled` (all hidden), `not connected` (registered, no tool), `not loaded` (not registered), `overridden by mcp.json`, `project not trusted`, `overridden by project scope`; add an example block for `overridden by mcp.json` and one for `project not trusted`. The example at line 3161 ("With pi-mcp-adapter absent, the `github` server's state is `status unknown`") now reads `not loaded` under Pi's built-in MCP for a plugin installed in the session (evidence: the companion-missing cell above). **`docs/json-output.md`** (line 951 lists the tokens): add a sentence on which tokens each implementation emits. Evidence: `builtin-status.feature`.
6. **`features/mcp-server/companion-missing.feature` line 76** (Phase 3, scenario `Plugin info names pi-mcp-adapter as a missing companion`): the `plugin components mcp` cell `"status":"status unknown"` becomes `"status":"not loaded"` under the builtin profile, realigning the table (from 02-04). Evidence: this gate's outcome (a), seeds 570831 and 880167.
7. **`test/orchestrators/plugin/info.test.ts`** (shared with the read-time verdicts): the MSEL-01 `builtin` case's reader snapshot names `plugin_alpha_srv`, not `plugin_alpha_srv_` (`builtin: statusSnapshot([{ name: "plugin_alpha_srv", status: "failed" }])`), changed by 02-04 (P2-DC-31). Keep that line when the read-time verdicts merge.
8. **`.fallowrc.json`** (frozen): `orchestrators/mcp/builtin-registration-step.ts` now imports `recordedMcpServers` and `createLegacyServersReader`, so drop `orchestrators/mcp/recorded-servers.ts` from `entry` and those two names from its `ignoreExports` (fallow never reports an `ignoreExports` name as stale). Run `npx fallow dead-code` after the edit; keep any other name it then reports as unused.
9. **Re-verify after the read-time verdicts merge:** the `info` scenarios of `builtin-status.feature` (their `plugin requires` and `plugin status` rows, P2-DC-16); every restart result of `implementation-switch.feature` (02-07 recorded none today); each `which did not fail` install that could become strict (the builtin twins of `configuration.feature`, `invocation.feature`, `sources.feature`, `builtin-values.feature`, `builtin-direct.feature`, `builtin-trust.feature`, `project-scope.feature`, and the enable and update twins of `lifecycle.feature`, P2-DC-78); and whether AMIG-01 stays ungated by implementation (if it becomes adapter-only, the legacy gap of P2-DC-11 spans every built-in session, and the doc's "Legacy mcp.json entries" text changes).
10. **`test/architecture/manifest-read-agreement.test.ts`** (unowned, from 02-01): add `bridges/mcp/builtin-description.ts` to the MANF-01 gate; it reads `MANIFEST_CANDIDATES` through `locateManifestCandidate`.
11. **`test/integration/adapter-expansion-conformance.test.ts`** (unowned, from 02-01): pass `ADAPTER_FIELD_ENCODER` at its two `substituteAndInject` calls; then make the encoder parameter of `bridges/mcp/substitute.ts` required and drop its default (P2-DC-19 as planned, P2-DC-53).
12. **`features/lib/upstream/`** (from 02-01): same move as item 4 (a), in Phase 6 (P2-DC-18).
13. **`.planning/codebase/CONVENTIONS.md`** (from 02-01 and 02-03): the `fallow-ignore` count goes from 44 to 45; `unused-export` markers on loader-read default exports are now seven, and the harness Pi extensions that Pi's `--extension` loader reads are five, adding `features/lib/mcp-builtin-config-probe/extension.ts`. Also note the three reasoned `@typescript-eslint/unbound-method` disables in the step and registration tests (strong-mock precedent).
14. **`.agents/skills/cucumber/rules/world-and-stand-ins.md`** (frozen, from 02-03, optional): name the config probe (`features/lib/mcp-builtin-config-probe/`) beside the registry probe as the extension a built-in values scenario loads through `extraExtensions` (P2-DC-24).
15. **`features/mcp-server/project-scope.feature`** description (from 02-05): it points to `builtin-status.feature` for the untrusted info row. 02-04 used that exact name, so no change is needed; listed so the parent can close it.
16. **`features/support/world.ts` / `features/lib/turn-records.ts`** (frozen harness, from 02-06): `assertStandInsStopped` runs at once after `pi.stop()`; poll briefly before it fails (a stand-in that Pi lost track of exits only when its stdin closes), or make `startSession` in `features/lib/pi-commands.ts` avoid the RPC double bind. Then lift "A new session offers the plugin's tool again (BLT-01)" in `features/mcp-server/lifecycle.feature` from `@adapter-only` to `@mcp`, and close the matching `.planning/WINDOWS.md` `unmet-truth` entry (P2-DC-77).
17. **Upstream Pi report** (from 02-06, not a repo edit): RPC `new_session` emits `session_start` twice (`dist/modes/rpc/rpc-mode.js` with `AgentSessionRuntime.finishSessionReplacement`), and the built-in MCP `session_start` handler (`dist/extensions/mcp/index.js`) does not close the connections of an earlier `session_start` in the same runtime.
18. **`.planning/phases/02-built-in-materialization/02-06-PLAN.md`** flagged assumption 2 (from 02-06, record only): "the scenarios hold either way" is false for Pi's built-in MCP when a server stays registered across `new_session`.
19. **After Phase 2 merges** (ROADMAP): rerun `npx fallow dupes` (the built-in and adapter entry and escape modules), and re-run the Phase 4 and Phase 5 built-in scenarios, since the extension's registration now serves the same tools as the stand-in.
20. **None** from 02-02, 02-07, and 02-09.


## From `02-built-in-materialization/02-09-SUMMARY.md`


None.


## From `03-read-time-verdicts/03-09-SUMMARY.md`


One entry per file, each with the exact change.

##### CHANGELOG.md (D-P3-21, MREC-07)

Under the next release's MCP built-in section:

- "`/claude:plugin install` and `list` show `{requires mcp}` when either MCP implementation would run every server of a plugin and none is loaded, and `{requires builtin mcp}` when only Pi's built-in MCP would; `{requires pi-mcp-adapter}` now shows only when only pi-mcp-adapter would run them all."
- "A plugin's available or partially available state, its MCP server verdicts, and `--partial` consent follow the MCP implementation Pi runs now (pi-mcp-adapter, Pi's built-in MCP, or none), so switching needs no reinstall. `list`, `info`, and `fetch` show the state for that implementation; `info` shows each server as written or left out, with the feature that blocks it."
- "`install` asks for `--partial` only for an MCP server the implementation Pi runs cannot run: an sse server under Pi's built-in MCP, or one that needs an elicitation handler under pi-mcp-adapter. With no MCP implementation, only servers neither can run need it. `update` asks only when the active implementation would leave out a server of the new version, and `enable` and `apply` never ask again after a switch; `pending` previews `(will partially install)` only where the active implementation cannot run a server."
- "`info`'s `requires:` line names the MCP implementation that runs every server (`mcp`, `pi-mcp-adapter`, or `builtin mcp`), tagged `(missing)` when the active one cannot run them all. `info --json` now reports `{\"companion\":\"mcp\"}` where it reported `pi-mcp-adapter` for most plugins."

##### docs/json-output.md

- Line 723 (`requires`): replace "Companion extensions the resolved components need, sorted by name." with "Companions (extensions or MCP implementations) the resolved components need, sorted by name. The MCP entry names `mcp` (either implementation runs every server), `pi-mcp-adapter`, or `builtin mcp`."
- Line 766 (`companion`): replace "Companion extension that a component needs." with "Companion extension or MCP implementation that a component needs: `pi-subagents`, `pi-dynamic-workflows`, `mcp`, `pi-mcp-adapter`, or `builtin mcp`."

##### docs/output-catalog.md

- Line 69: replace "The soft-dep markers `requires pi-subagents`, `requires pi-mcp-adapter` and `requires pi-dynamic-workflows`" with "The soft-dep markers `requires pi-subagents`, the three MCP markers `requires mcp`, `requires pi-mcp-adapter`, and `requires builtin mcp`, and `requires pi-dynamic-workflows`", and add after the marker-order sentence: "The MCP marker follows the active implementation and the row's `runEvery` (D-MB-07): no marker when the active implementation runs every server, otherwise the marker of the implementation that would. A `partially-installed` list row that an implementation outside `runEvery` blocks carries it beside `{unsupported mcp}`."
- Line 3041: replace "Agents need `pi-subagents`, MCP servers need `pi-mcp-adapter`, and workflows need `pi-dynamic-workflows`." with "Agents need `pi-subagents`, MCP servers need the implementation that runs every server (`mcp` for either, `pi-mcp-adapter`, or `builtin mcp`), and workflows need `pi-dynamic-workflows`."; replace "The companions are sorted by package name" with "The companions are sorted by name (so `builtin mcp` and `mcp` come before the `pi-` names)"; replace "A companion that the soft-dependency probe does not find loaded carries a `(missing)` tag after its name." with "A companion that the soft-dependency probe does not find loaded carries a `(missing)` tag after its name; the MCP entry carries it exactly when the row's D-MB-07 marker would show. A plugin whose every server both implementations block gets no MCP entry."
- Line 3161: replace the example prose "pi-mcp-adapter runs its MCP servers. The `requires:` line names both, sorted by package name. The probe finds pi-subagents loaded but does not find pi-mcp-adapter, so only pi-mcp-adapter carries the `(missing)` tag. Pi's built-in MCP client does not count as pi-mcp-adapter." with "either MCP implementation runs its stdio `github` server, so the line names `mcp`. The `requires:` line names both, sorted by name. The probe finds pi-subagents loaded and finds no MCP implementation, so only `mcp` carries the `(missing)` tag.", and the rendered example line from `requires: pi-mcp-adapter (missing), pi-subagents` to `requires: mcp (missing), pi-subagents`. Catalog counters stay 324 states and 54652 bytes unless the example block is a counted fixture; re-run `test:unpaired` after the change.
- Lines 3176-3188 (`installed-with-every-companion`): the prose "lists them in package-name order: pi-dynamic-workflows, pi-mcp-adapter, pi-subagents. The probe finds pi-subagents and pi-mcp-adapter loaded" becomes "lists them in name order: mcp, pi-dynamic-workflows, pi-subagents. The probe finds pi-subagents and an MCP implementation loaded", and the rendered line `requires: pi-dynamic-workflows (missing), pi-mcp-adapter, pi-subagents` becomes `requires: mcp, pi-dynamic-workflows (missing), pi-subagents`.
- The catalog blocks are byte contracts against `test/architecture/catalog-uat/fixtures/plugin-info.ts`, which builds `requires` literals by hand (`{ companion: "pi-mcp-adapter", ... }` at lines 86, 115, and 533-711). Any block above that changes needs the matching fixture literal changed to `"mcp"` in the same commit, then `npm run test:unpaired`.
- The install refusal and install/enable/update rows of an MCP plugin follow the active implementation (03-05, 03-06): any prose there that says "pi-mcp-adapter cannot run" reads "the active MCP implementation cannot run".

##### README.md and README.es.md

- README.md line 144: replace "an MCP server that uses a feature pi-mcp-adapter cannot run" with "an MCP server that the MCP implementation Pi runs cannot run (pi-mcp-adapter or Pi's built-in MCP)".
- README.es.md line 144: replace "un servidor MCP que usa una función que pi-mcp-adapter no puede ejecutar" with "un servidor MCP que la implementación de MCP que ejecuta Pi no puede ejecutar (pi-mcp-adapter o el MCP integrado de Pi)".

##### .fallowrc.json

- In `ignoreExports` for `extensions/pi-claude-marketplace/domain/mcp-implementation.ts`, remove `ActiveMcpImplementation`, `EffectiveMcpCompatibility`, and `effectiveMcpCompatibility`; keep `StoredMcpCompatibility`.
- In `ignoreExports` for `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`, remove `LegacyServersReader`, `LegacyServersSource`, `createLegacyServersReader`, and `recordedMcpServers`; keep `LegacyServers`, `LegacyServersUnreadableError`, and `LegacyServersUnreadableReason`.
- Both `entry` lines stay: each module still has an unconsumed name.

##### extensions/pi-claude-marketplace/edge/register.ts and shared/completion-cache.ts (P3-DC-22)

- `edge/register.ts` (frozen) passes the run's active MCP implementation to the completion resolver, and `shared/completion-cache.ts` keys its plugin index by it, so `update --partial` and `install --partial` completions follow the active implementation instead of the implementation-neutral view.

##### .planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md

- Interface 3: "An install writes a new record without the basis" becomes "An install writes `compatibilityBasis: \"neutral\"`" (D-P3-02).

##### orchestrators/types.ts and reconcile/apply.ts (03-06 candidate)

- 03-06 listed carrying `mcpImplementation: run.softDeps.mcpImplementation` through `PluginConvergeTarget` and `runStep`; plan 03-07 landed that change (`1178bd7 fix(apply): judge catalog moves under the run's MCP implementation`), so the parent needs no edit. Listed for the record.

##### Already done by this plan

- `orchestrators/plugin/mcp-verdict-read.ts` header: `update-swap.ts` dropped from the import ban (`67d71f0`).

##### Addendum after the review, verification, and transition (orchestrator)

- **CHANGELOG.md, third bullet above (correction, P3-DC-112):** replace "`update` asks only when the active implementation would leave out a server of the new version" with "a dependency move during `install` or `update` asks only when the active implementation would leave out a server the installed version does not already leave out; a plain `update` asks as before when the new version is partially available".
- **CHANGELOG.md (CR-01, WR-05):** "The first load after the upgrade records the MCP servers of plugins installed by earlier versions together with their implementation-neutral verdict, when the recorded version's servers can still be read."
- **.planning/BACKLOG.md (P3-DC-122):** "apply refuses a declared install pending previews as will partially install; choose one behavior for both" (predates Phase 3 for every partially-available kind; Phase 3 makes it reachable for an sse plugin under Pi's built-in MCP).
- **.planning/PROJECT.md (transition `evolve_project`; Phase 6 owns the file):** move MREC-03, MREC-04, MREC-05, MREC-06, and MREC-07 to Validated with "Phase 3 (mcp-builtin)"; add Key Decisions rows for the phase's load-bearing choices if the user accepts them in the review: the neutral stored verdict (`compatibilityBasis: "neutral"`, P3-DC-01/02/15), the D-MB-07 marker table and `requires:` naming (P3-DC-05/07), consent per active implementation with record-driven sites on the neutral view (P3-DC-09/10/20), and the user-run `update` keeping today's consent rules (P3-DC-112). Update "Last updated" to "after mcp-builtin Phase 3".
- **orchestrators/mcp/recorded-servers.ts (frozen; Phase 6 hardening, from the security audit):** the git-source root callback returns `record.resolvedSource` with no containment check against `plugin-clones/`; path sources are contained. Only classification output reaches a row, so it is low severity; consider `assertPathInside` there.
- **Known flakes (for the parent's list):** Phase 2's `features/mcp-server/lifecycle.feature:396` "A new session offers the plugin's tool again" failed once under the adapter profile under load (seed 115524) and passed 4/4 alone and in a full rerun (seed 888709).


## From `04-agent-grants/04-02-SUMMARY.md`


None. No frozen file changed. `index.ts` is unchanged.


## From `04-agent-grants/04-04-SUMMARY.md`


None. No frozen file needed a change. `agentGrantsStep` keeps its export and input type. Its new second parameter has a default, so the materializer's one-argument step type still accepts it (P4-DC-14).


## From `04-agent-grants/04-05-SUMMARY.md`


- Phase 3 / 04-06: the verdict-markers `diagnostic` row text above.
- When Phase 3's implementation field on `ThreePhaseArgs` lands, repoint `updateAgentImplementation` in `update-swap.ts` at it (P4-DC-13). Then autoupdate and apply convergence stage the active form directly.
- No frozen file changed.


## From `04-agent-grants/04-06-SUMMARY.md`


Each line names the file, the exact change, and when the parent applies it.

1. **`features/mcp-server/verdict-markers.feature` (Phase 3's).** In the `@builtin-only` scenario "Update preserves dependency move warnings and MCP notices, under Pi's built-in MCP" (line 604), in the `lines` cell of the `diagnostic` row, replace `a launch before pi-mcp-adapter has cached the server's tools still fails` with `a launch before Pi's built-in MCP has listed the server's tools still fails`. Change nothing else in the row. **When:** in the Phase 4 merge commit on the milestone branch, or the post-merge builtin gate fails. Phase 3 keeps the new text when it merges the milestone branch into its own branch (P4-DC-04, P4-DC-23).
2. **`extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` (Phase 4's function `updateAgentImplementation`).** Repoint it at Phase 3's implementation field on `ThreePhaseArgs`. Read that field first, then the direct run, then `preflightNotification.run`, then `none`. Then autoupdate and `apply` convergence stage the active form at once, and the adapter form no longer stays under built-in until the next session. **When:** after Phase 3 merges, in the first commit that has both phases' code. Add a `@builtin-only` cucumber scenario for an autoupdate or apply-convergence update that pins the built-in grant before a reload (P4-DC-13, P4-DC-46, P4-DC-60).
3. **`.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md`, interface 5 (session step contracts).** Record the signature `agentGrantsStep(input: AgentGrantsStepInput, env: SubagentChildEnv = process.env): Promise<void>`. It takes an optional second parameter with a `process.env` default, and it stays assignable to the materializer's one-argument step type `(input: AgentGrantsStepInput) => Promise<void>` (P4-DC-14). Also record that the unowned `createLoadReconcile(reader, applyReconcile, env: SubagentChildEnv = process.env)` takes an optional third `env` parameter. The frozen `index.ts` call does not change (P4-DC-08). `SubagentChildEnv` is `Readonly<Record<string, string | undefined>>` from `platform/subagent-child.ts`. **When:** at the Phase 4 merge.
4. **`docs/mcp-compatibility.md` (Phase 2's), agents text.** Drafted in the file's style. **When:** with Phase 2's built-in docs, after Phase 2 and Phase 4 are both on the milestone branch. Phase 6 folds them in if Phase 2 has already merged.
   - Line 27, after "pi-subagents `mcp:` entries also use the key.", add: "Under Pi's built-in MCP, they use the built-in server name instead, `plugin_<plugin>_<server>`, with no `_` at the end."
   - The line-275 bullet ("A `tools:` entry that names one of the plugin's own MCP tools ..."), after the whole-server sentence, add: "Under Pi's built-in MCP, these entries are `mcp:plugin_<plugin>_<server>/<tool>` and `mcp:plugin_<plugin>_<server>`. The grant names the server of the MCP implementation that is active when the agent is written. A per-tool `disallowedTools` entry of an agent without `tools:` becomes, in `excludeTools`, the tool name that Pi's built-in MCP gives the tool: `mcp__plugin_<plugin>_<server>__<tool>` with each character other than a letter, a digit, or `_` replaced by `_`. Pi shortens a name longer than 64 characters and adds a hash. Under pi-mcp-adapter the entry keeps the Claude Code name. A grant of a server that Pi's built-in MCP cannot run, such as an `sse` server, is dropped with a warning under built-in and kept under pi-mcp-adapter."
   - The line-277 paragraph (async), after "also after pi-mcp-adapter has cached the server's tools.", add: "Under Pi's built-in MCP the install warning ends `a launch before Pi's built-in MCP has listed the server's tools still fails`. pi-subagents 0.84.0 refuses a foreground launch of such an agent because an extension registered the server. For the stub server of `demo`, it returns: `Agent 'demo:runner' selects MCP tools from servers that extensions registered (plugin_demo_stub). Only background children (async: true) load those extensions; run the agent in the background or add the server to the global mcp.json or a trusted project's .pi/mcp.json.`" Change both citations of `features/mcp-server/invocation.feature` in this section (line 275 bullet 1 and line 277) to `features/mcp-server/agent-grants.feature`, the file Phase 1 renamed.
   - The line-283 paragraph ("In Claude Code, a subagent ..."), change its last sentence to: "A launch before pi-mcp-adapter has cached the server's tools, or before Pi's built-in MCP has listed them, fails too."
   - The override example: add a second line after the JSON block: "Under Pi's built-in MCP, write `mcp:plugin_foo_github` instead." In the paragraph after it, add: "Under Pi's built-in MCP, an `mcp:<name>` entry grants the tools of the built-in server `<name>`, such as `plugin_foo_github`."
   - A new paragraph at the end of "Customizing generated agents": "When you switch between pi-mcp-adapter and Pi's built-in MCP, the next start or `/reload` rewrites each generated agent file whose MCP grant differs for the new implementation. It rewrites only those files, one at a time, and reports nothing (D-MB-03, MGRT-01). With no MCP implementation active, the files stay as they are. A file that you edited stays as it is. An agent that an earlier release installed is translated to the built-in form at the first built-in session, with two known gaps: an agent with a per-tool `disallowedTools` name longer than 64 characters stays in the pi-mcp-adapter form, and the grant of a server that Pi's built-in MCP cannot run is translated, not dropped, so the launch still fails. Run `/claude:plugin reinstall` for such a plugin to write the exact form. A pi-subagents background child that loads this extension changes nothing: it rewrites no agent file, runs no autoapply, and moves no MCP server (MGRT-02)."
5. **`CHANGELOG.md`.** Two reader-facing lines for the milestone's entry. **When:** Phase 6 folds them into the milestone bullet.
   - MGRT-01: "A generated agent's MCP grant now names the server in the form of the active MCP implementation, pi-mcp-adapter or Pi's built-in MCP. After you switch, the next start or `/reload` rewrites only the agent files whose grant changed."
   - MGRT-02: "A pi-subagents background child that loads the extension no longer changes any installation state. It runs no autoapply, moves no MCP server, and rewrites no agent file."
6. **`README.md` and `README.es.md`.** The Features list says only "Agents. Requires pi-subagents." The MCP naming text at line 126 describes the adapter key, and Phase 2 or Phase 6 owns its built-in update. The agents text does not need a sentence on grants. If Phase 6 adds the built-in MCP option to the Features list, add after the agents bullet's first sentence: "An agent's MCP grants follow the MCP implementation in use." README.es.md: "Los permisos MCP de un agente siguen la implementación MCP en uso." **When:** Phase 6, with the milestone's README pass, only if the built-in option enters the Features list.
7. **`.planning/PROJECT.md` Key Decisions.** D-MB-03 row: add "Implemented by mcp-builtin Phase 4: the session-start grants step (`orchestrators/mcp/agent-grants-step.ts`, `bridges/agents/grant-rewrite.ts`) swaps a stored frontmatter form, and earlier releases' agents get a textual translation (P4-DC-06)." D-MB-12 row: add "Implemented by Phase 4 with the `PI_SUBAGENT_CHILD=1` marker (`platform/subagent-child.ts`, P4-DC-07). In a child the grants step does nothing, and the load skips autoapply and the AMIG-01 move. The MIG-01 config migration and `loadState`'s legacy migration stay ungated, because they are idempotent and the parent's load runs them first (P4-DC-08)." **When:** at the Phase 4 merge, or by Phase 6.
8. **`.planning/BACKLOG.md`.** Two items from CONTEXT "Deferred Ideas":
   - "Exact legacy translation of agent grants under Pi's built-in MCP: per-tool `excludeTools` names over 64 characters (Pi's hashed name), and grants of servers built-in cannot run (`sse`), which should be dropped with the staging warning (P4-DC-06, P4-DC-30)."
   - "A user-visible load warning when the grants step cannot rewrite an agent (edited file, held lock, corrupt index row). Needs a closed-set reason and catalog states (P4-DC-09, P4-DC-32)."
   **When:** at the Phase 4 merge, or by Phase 6.
9. **`.planning/codebase/ARCHITECTURE.md` and `STACK.md`.** **When:** Phase 6's codebase-map refresh (P4-DC-40).
   - ARCHITECTURE.md, `platform/` layer "Contains": add "`subagent-child.ts` (`isSubagentChild(env)`, reads pi-subagents' `PI_SUBAGENT_CHILD=1`; D-MB-12)".
   - ARCHITECTURE.md, `bridges/` layer "Contains": add "`agents/grant-forms.ts` (renders an agent's adapter and built-in forms), `agents/grant-rewrite.ts` (the session-start swap of a stored frontmatter form), `agents/legacy-grant-form.ts` (the textual adapter-to-built-in translation for rows an earlier release wrote), `agents/mcp-async-warning.ts` (the D-CF6-10 warning per implementation)". Add that an agents-index row may hold `mcpImplementation` plus one stored form per implementation (frontmatter block, warnings, dropped tools), additive with `schemaVersion` 1.
   - ARCHITECTURE.md, "Load-Time Reconcile Flow": add that the session materializer's agent grants step (`orchestrators/mcp/agent-grants-step.ts`) rewrites, under the state lock, the generated agent files whose stored form differs from the active implementation (D-MB-03 amends APL-D1). Add that in a pi-subagents background child `loadReconcile` skips autoapply and the AMIG-01 move, and the grants step does nothing (D-MB-12).
   - STACK.md, `pi-subagents` bullet: add "a background child is detected by the `PI_SUBAGENT_CHILD=1` variable its runner sets (`platform/subagent-child.ts`)".
10. **`.fallowrc.json` (frozen).** In the `ignoreExports` entry for `domain/mcp-implementation.ts`, drop `ActiveMcpImplementation`. Phase 4's `bridges/agents/types.ts` and `orchestrators/plugin/update-swap.ts` import it from that module, so the entry is no longer needed. fallow never reports an `ignoreExports` name as stale. **When:** Phase 6, when it removes the frozen-module entries.
11. **Re-run after Phase 2 merges.** Run `features/mcp-server/agent-grants.feature` under both profiles: `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature` (12 scenarios today) and `... --profile builtin features/mcp-server/agent-grants.feature` (5 scenarios today). Phase 2's own registration then serves the stub in place of the Phase 1 stand-in, and the `@own-implementation` built-in Pis connect it. **When:** in the post-merge gate of the Phase 2 merge. A failure there is fixed in the step module or the scenario, not by retagging.


## From `05-hook-tool-names/05-01-SUMMARY.md`


None. No frozen file needed a change.


## From `05-hook-tool-names/05-02-SUMMARY.md`


- BACKLOG (T-05-07, P5-DC-15): when pi-mcp-adapter and Pi's built-in MCP are both loaded, a built-in tool whose name Pi cut inside the namespace, called with a string `tool` and no `action`, is still skipped as a proxy call. Hardening: skip only a call whose tool pi-mcp-adapter registered (a tool whose `sourceInfo` is not `builtin:mcp`).
- CHANGELOG (Phase 6, MDOC-02): "Hooks: pi-mcp-adapter's rule that a proxy `mcp` call runs no hook now applies only while pi-mcp-adapter is the active MCP implementation. Under Pi's built-in MCP every tool call runs its hooks."
- No frozen file needed a change.


## From `05-hook-tool-names/05-03-SUMMARY.md`


None. No frozen file needed a change. The CHANGELOG and README lines for built-in hook tool names stay with the parent (Phase 6, MDOC-02).


## From `05-hook-tool-names/05-04-SUMMARY.md`


Each line names its target file and its owner. The parent applies them at the merge of `features/mcp-builtin-phase-5` or in Phase 6.

1. **`CHANGELOG.md` (Phase 6, MDOC-02; parent).** Draft bullet, to merge into the milestone's built-in MCP entry: "Hooks: under Pi's built-in MCP, plugin hooks see MCP tools under Claude Code's names, `mcp__<server>__<tool>` with the server's `-` kept (`mcp__plugin_<plugin>_<server>__<tool>` for a plugin server). So matchers and `if` fields written for Claude Code fire on built-in calls. Only the tool segment keeps Pi's change of `-` to `_`, because Pi does not report the original tool name. pi-mcp-adapter's rule that a proxy `mcp` call runs no hook now applies only while pi-mcp-adapter is the active MCP implementation. Under Pi's built-in MCP, every tool call runs its hooks." This bullet covers 05-02's line too: "Hooks: pi-mcp-adapter's rule that a proxy `mcp` call runs no hook now applies only while pi-mcp-adapter is the active MCP implementation. Under Pi's built-in MCP every tool call runs its hooks."
2. **`README.md` and `README.es.md` (Phase 6, MDOC-02; parent).** None. Both READMEs give hooks one line, "Hooks. Partial support.", with a link to `docs/hooks-compatibility.md`. They name no MCP tool matcher. Phase 5 already wrote the built-in names into `docs/hooks-compatibility.md` (D-P5-14). If Phase 6 adds a built-in MCP section to the READMEs, one sentence can point to that doc for hook tool names.
3. **`.agents/skills/cucumber/**` (frozen; parent).**
   - `rules/world-and-stand-ins.md`, section "The scripted model". The rule "A feature file writes the whole script as literals" gains one exception: "The shared `@mcp` hook scenarios are the one exception. Their step `the scripted model calls the tool {string} of the hooks' stub mcp server {string} of the plugin {string} through the mcp implementation with {string}, then replies {string}` (in `hook/tool-use.steps.ts`, through `features/lib/hook-mcp-calls.ts`) builds the script from `profileFor(...).toolName`, because no literal names the tool under both implementations (P5-DC-14)."
   - Same file, section "Stand-ins of the profile Pi". Add: "`features/lib/hook-mcp-tool-server.ts` is a stdio JSON-RPC server with no dependencies, no request log, and no pid file. It lists one tool named by its argument, answers `tools/call` with `<tool>:<text>`, and exits when its stdin ends. `pi's mcp.json configures the server {string} with the hooks' stub mcp tool {string}` writes `{agent dir}/mcp.json` with that server under `direct` exposure. Write it after the install and before `pi runs with the scripted model and the mcp implementation`. It refuses a started profile Pi, and the file is removed when the scenario ends."
   - `rules/layout.md`, section "Function directories", hooks paragraph. `tool-use.steps.ts` "the stub MCP server `Given` steps" becomes "the stub MCP server `Given` steps, the profile-aware MCP call step, and the `mcp.json` step".
4. **`.planning/PROJECT.md` Key Decisions (parent).** Draft rows. The parent may instead keep them as D-MB-08 detail.
   - "Hook-facing name of a built-in MCP tool (D-P5-01, D-P5-02, D-P5-03). A tool whose `sourceInfo.path` is `builtin:mcp` reaches hooks as `mcp__<namespace alias>__<rest of Pi's name>`, with the server's `-` kept and the tool segment in Pi's folded or cut form. If Pi's 64-character cut falls inside the namespace, Pi's name is kept. The name is read from `pi.getAllTools()` at dispatch time only."
   - "Built-in MCP matching (D-P5-04). An MCP literal or `if` literal fires when its server is the tool's alias and Pi's `createMcpToolName(server, tool)` gives the event's tool name. So Claude Code's full name and the folded tool segment both fire, and a folded server segment does not."
   - "Proxy rule scope (D-P5-06, D-P5-07, MHK-02). D-CF5-12 applies only while `openNotificationSnapshot(pi).softDeps.mcpImplementation` is `adapter`. The answer is read at the first proxy-shaped call of a bridge generation and kept for that generation."
5. **`.planning/BACKLOG.md` (parent).**
   - Deferred idea (05-CONTEXT.md; P5-DC-09, P5-DC-35): name Pi's `tool_search` as Claude Code's `ToolSearch` in hook stdin and matchers. If done, the `*` rows on `tool_search` in `tool-use.feature` change.
   - Deferred idea (05-CONTEXT.md): recover the original tool segment from a tool result's `details.tool`. Not taken, because a PreToolUse event has no details, so the two events would disagree.
   - Hardening (T-05-07, P5-DC-15, from 05-02): when pi-mcp-adapter and Pi's built-in MCP are both loaded, a built-in tool whose name Pi cut inside the namespace, called with a string `tool` and no `action`, is still skipped as a proxy call. Fix: skip only a tool that pi-mcp-adapter registered, never a tool whose `sourceInfo.path` is `builtin:mcp`.
   - Matcher parity gaps (P5-DC-16): Claude Code 2.1.318 treats a matcher made only of `[a-zA-Z0-9_|, -]` as a list of exact names (spaces and commas allowed) and any other matcher as an unanchored regex. This project accepts only `[A-Za-z0-9_|-]` and matches server prefixes with `startsWith`.
   - Coverage gap (P5-DC-24): MHK-02's no-implementation case has unit rows only. A scenario needs a harness extension that registers a proxy-shaped tool with no MCP implementation loaded (a new stand-in).
6. **`.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md` (parent, codebase-map refresh).**
   - STRUCTURE.md: add `domain/components/hooks/builtin-mcp-tool-names.ts` (Pi 1.5.0 `createMcpToolName` candidates, built-in literal and server-prefix rules, Claude-form name) and `bridges/hooks/mcp-tool-view.ts` (`createHookToolView(pi)`: `identify` and `proxyRuleApplies`).
   - ARCHITECTURE.md, the hooks bridge: for an `mcp__` tool event with a non-empty bucket, the tool handlers read `pi.getAllTools()` once per event at dispatch time, never at factory time (MSEL-01). `registerHooksBridgeWith` creates one `HookToolView` per bridge generation, and its `proxyRuleApplies()` reads the run snapshot's `mcpImplementation` once per generation.
   - CONVENTIONS.md, dependency injection: `compositeHandlerFor` and `toolResultCompositeHandler` take a defaulted last parameter `tools: HookToolView = createHookToolView(pi)`, next to the defaulted `executor`. Creating the view reads nothing (P5-DC-19).
7. **Merge note (parent).** After Phase 2 merges, re-run the Phase 5 builtin scenarios (`npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature features/hook/tool-use.feature`, and the adapter run of the same files). The extension's own registration then replaces the stand-in for `plugin_hook-demo_stub-server` and for the long plugin's server (`hook-proxy-shaped-tool-names-of-a-long-plugin`). Phase 2's server names must keep Pi's namespace alias equal to the registered name, with `-` kept, or the Claude-form name falls back to Pi's name.
8. **Merged from earlier plans.** 05-01: none. 05-02: the BACKLOG hardening (line 5, third item) and the CHANGELOG proxy sentence (line 1). 05-03: none, with the note that the CHANGELOG and README lines stay with the parent (lines 1 and 2). No plan needed a change to a frozen file, apart from the cucumber-skill text in line 3.


## Parent notes from child messages (not in a SUMMARY)

- P4-DC-13: repoint autoupdate/apply-convergence agent staging to the active implementation after Phase 3 merges.
- P4 parent line 1: verdict-markers.feature built-in async warning text (Phase 3 owns; it will apply after merging the milestone branch).
- P4-DC-40: .planning/codebase map updates.
- P4 docs: docs/mcp-compatibility.md agents section gains the built-in mcp: form.
- P3-DC-22: frozen edge/register.ts completion resolver gets no run; completion cache keys only scope+marketplace.
- P2-DC-18: move Phase 2's tool_search projection into features/lib/upstream/ (Phase 6).
- P2-DC-22: re-pin env deny-lists to Claude Code 2.1.318 (backlog).
- Watch at merge: P3-DC-36 (project-scope.feature cell), P3-DC-30/P4-DC-38 (install-outcome.ts, update-swap.ts prepareUpdateHandles).
- Watch at merge: P2-DC-43 companion-missing.feature:76 builtin status cell -> `not loaded` (Phase 3 owns; told Phase 3); P2-DC-31 info.test.ts fixture line edited by Phase 2 in Phase 3's file.
- Phase 2 parent lines (02-01): test/architecture/manifest-read-agreement.test.ts must list bridges/mcp/builtin-description.ts (MANF-01); test/integration/adapter-expansion-conformance.test.ts passes the encoder at its two calls, then make it required (P2-DC-53); move features/lib/mcp-builtin-tool-search.ts into features/lib/upstream/ (Phase 6); .fallowrc.json entry + ignoreExports for recorded-servers.ts can go.
- Phase 3 parent lines: edge/register.ts passes the run's implementation to the completion resolver and shared/completion-cache.ts keys by it (P3-DC-22); 01-FROZEN.md interface 3 text "An install writes a new record without the basis" is outdated (install writes compatibilityBasis "neutral"); CHANGELOG: `list` follows the active MCP implementation.
- Phase 2 parent line (P2-DC-77): Pi 1.5.0 RPC new_session double session_start leaks built-in MCP stdio connections; frozen harness (turn-records.ts assertStandInsStopped or pi-commands.ts startSession) should wait for stand-ins or avoid the double bind; Phase 2's new-session scenario is @adapter-only meanwhile (WINDOWS 112); report upstream to Pi. Relayed to Phases 4 and 5 at 15:08Z.
- Phase 3 CHANGELOG candidate: "`/claude:plugin info` shows each MCP server as written or left out for the MCP implementation Pi runs, with the feature that blocks it, and `info` and `fetch` show the plugin state for that implementation."
- Phase 2 parent lines (wave 2): keep Phase 2's edit of info.test.ts MSEL-01 builtin snapshot (names plugin_alpha_srv) at the Phase 3 merge; CONVENTIONS.md fallow-ignore count 44 -> 45 plus the config probe as a fifth loader-read extension; optional cucumber skill note on the config probe.
- Phase 5 parent lines: BACKLOG: with adapter AND built-in both loaded, a cut-name built-in call with a string `tool` is still skipped as a proxy call (fix: skip only tools pi-mcp-adapter registered; T-05-07/P5-DC-15). CHANGELOG: "Hooks: pi-mcp-adapter's rule that a proxy mcp call runs no hook now applies only while pi-mcp-adapter is the active MCP implementation. Under Pi's built-in MCP every tool call runs its hooks."
- Phase 3 parent line: docs/output-catalog.md lines 69, 3041, 3161 need the three D-MB-07 markers in their prose (frozen catalog file).
- Phase 4 parent lines (04-06-SUMMARY.md): 1 verdict-markers.feature built-in row text (Phase 3); 2 repoint updateAgentImplementation to Phase 3's ThreePhaseArgs field + new @builtin-only autoupdate/apply-convergence scenario; 3 frozen agentGrantsStep(input, env) and createLoadReconcile env param notes; 4 docs/mcp-compatibility.md agents section; 5 CHANGELOG MGRT-01/02; 6 README conditional; 7 PROJECT.md D-MB-03/D-MB-12; 8 two BACKLOG items; 9 codebase maps; 10 drop ActiveMcpImplementation from .fallowrc.json ignoreExports (Phase 6); 11 re-run agent-grants.feature both profiles after Phase 2 merges.
- Phase 2 parent line (P2-DC-90): mint D-MB-NN decision IDs for P2-DC-02/04/05/08/10/13/14/20/46 and re-point docs/mcp-compatibility.md citations (Phase 6).
- Phase 5 parent lines (05-04-SUMMARY "## Parent lines"): CHANGELOG bullet (built-in hook tool names, tool-segment fold, proxy rule only under the adapter); frozen cucumber skill (world-and-stand-ins.md exception for the profile-aware call step P5-DC-14, stand-in entries for features/lib/hook-mcp-tool-server.ts and the mcp.json step; layout.md hooks paragraph); PROJECT.md draft rows D-P5-01..04, D-P5-06/07 (or keep under D-MB-08); BACKLOG (ToolSearch naming, details.tool recovery, P5-DC-15 hardening, P5-DC-16 matcher gaps, P5-DC-24 no-implementation scenario); codebase maps; after Phase 2 merges re-run features/hook/mcp-tool-names.feature and tool-use.feature under both profiles.
16:54Z Phase 2 verification: human_needed accepted provisionally (P2-DC-100); manual UAT in 02-UAT.md for the user review; REQUIREMENTS traceability for 11 IDs is a parent task.
- Phase 3 parent lines (wave 4): docs/output-catalog.md 3041, 3161 and docs/json-output.md 723, 766 `requires:` wording (frozen); CHANGELOG lines for consent per active implementation and the requires: change (most plugins now report {"companion":"mcp"}).

- CHANGELOG.md: four lines (D-P3-21).
- docs/json-output.md 723, 766; docs/output-catalog.md 69, 3041, 3161 example + rendered line, every-companion block (3176-3188). Change the fixture literals in test/architecture/catalog-uat/fixtures/plugin-info.ts in the same commit; run test:unpaired.
- README.md and README.es.md line 144.
- .fallowrc.json: remove 7 consumed ignoreExports names; still unused: StoredMcpCompatibility, LegacyServers, LegacyServersUnreadableError, LegacyServersUnreadableReason.
- edge/register.ts + completion-cache.ts (P3-DC-22).
- 01-FROZEN.md interface 3.
- Phase 3 BACKLOG parent line (P3-DC-122): "apply refuses a declared install pending previews as will partially install; choose one behavior for both".
- Known flake: lifecycle.feature:396 "A new session offers the plugin's tool again" (adapter, under load; P3-DC-111).
