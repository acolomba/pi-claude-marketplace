---
phase: 09-adapter-entries-and-mcp-features
verified: 2026-11-16T07:44:06Z
status: passed
score: 38/38 must-haves verified (29 VERIFIED, 9 PASSED (override)); 7 judgment-tier prohibitions flagged
covered_files: [".planning/phases/09-adapter-entries-and-mcp-features/09-01-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-01-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-02-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-02-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-03-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-03-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-04-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-04-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-05-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-05-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-06-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-06-SUMMARY.md","CHANGELOG.md","docs/json-output.md","docs/mcp-compatibility.md","docs/output-catalog.md","extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/marker.ts","extensions/pi-claude-marketplace/bridges/mcp/stage.ts","extensions/pi-claude-marketplace/bridges/mcp/types.ts","extensions/pi-claude-marketplace/bridges/mcp/unstage.ts","extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts","extensions/pi-claude-marketplace/domain/mcp-server-features.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts","extensions/pi-claude-marketplace/shared/errors-bridges.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-json.ts","extensions/pi-claude-marketplace/shared/notification-mcp.ts","extensions/pi-claude-marketplace/shared/notification-resolve.ts","extensions/pi-claude-marketplace/shared/notification-types.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","features/hook/mcp-tool-names.feature","features/lib/hook-mcp-tool-server.ts","features/lib/mcp-implementation.ts","features/lib/mcp-server-files.ts","features/lib/mcp-stub-server.ts","features/mcp-server/companion-missing.feature","features/mcp-server/configuration.feature","features/mcp-server/invocation.feature","features/mcp-server/legacy-move.feature","features/mcp-server/lifecycle.feature","features/mcp-server/project-scope.feature","features/mcp-server/resources.feature","features/plugin/subagent-child.feature","features/step_definitions/hook/tool-use.steps.ts","features/step_definitions/mcp-server/lifecycle.steps.ts","features/step_definitions/mcp-server/listing.steps.ts","features/step_definitions/mcp-server/resources.steps.ts","features/step_definitions/mcp-server/verdict-settings.steps.ts","schema/claude-plugin.schema.json","test/architecture/integration-materialization-gate.test.ts","test/architecture/mcp-config-notices.test.ts","test/bridges/mcp/adapter-doc.test.ts","test/bridges/mcp/adapter-entry.test.ts","test/bridges/mcp/marker.test.ts","test/bridges/mcp/stage.test.ts","test/bridges/mcp/unstage.test.ts","test/domain/mcp-server-features.test.ts","test/integration/mcp-home-path-partial.test.ts","test/integration/mcp-legacy-sweep.test.ts","test/integration/mcp-override-lifecycle.test.ts","test/integration/mcp-variable-expansion.test.ts","test/orchestrators/marketplace/shared.test.ts","test/orchestrators/plugin/install-flow-ledger.test.ts","test/orchestrators/plugin/reinstall-flow.test.ts","test/orchestrators/plugin/update-flow.test.ts","test/orchestrators/plugin/update-swap.test.ts","test/orchestrators/reconcile/mcp-migration.test.ts","test/shared/errors-bridges.test.ts","test/shared/notification-json.test.ts","test/shared/notification-mcp.test.ts","test/shared/notification-resolve.test.ts"]
covered_digest: "v4:sha256:453b213d5127cfbbf47cd6789c2a905b6ffa133946914d9d34c3c4e4154f8dda"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "The openUi default on every plugin server entry: 09-03 truths 1 and 2 (a stdio entry holds openUi false and its marker records all three defaults; a remote entry holds openUi false), the UI clause of 09-03 truth 5 (no initialize declares the MCP Apps UI extension), the `all three defaults` of 09-03 truth 6, the `three recorded defaults` of 09-04 truth 6, and 09-05 truth 2 (the page says every plugin entry gets openUi false)"
    reason: "Recorded decision D-PG9-07 as amended during execution (PROJECT.md:2427, 09-CONTEXT.md:176; fix 7b7bf951): pi-subagents 0.88.1 computeMcpServerHash leaves out openUi, so an openUi false default makes the adapter tool cache read as stale and an agent with a plugin MCP grant cannot launch. No openUi default is written (domain/mcp-server-features.ts:87-90, :111-116; test `D-PG9-07: no transport's defaults hold openUi` passed here). Each truth holds for everything but openUi: stdio entries and the 0.23.0 reinstall hold the two remaining defaults, timeout and lifecycle, in that order (features/mcp-server/configuration.feature:64, features/mcp-server/lifecycle.feature:601, :933); the adapter initialize rows still declare io.modelcontextprotocol/ui (features/mcp-server/invocation.feature:29, :159, :190); the page states the withheld default and its reason (docs/mcp-compatibility.md:174, :385, :759). Carrier BACKLOG MCPOPENUI-01 (BACKLOG.md:5474). Roadmap criterion 5 takes its `or the page cites the recorded decision` branch, so only plan truths need this override. Widened in this pass to name every plan clause the amendment changes; the previous report named three of them."
    accepted_by: "project decision D-PG9-07 as amended (PROJECT.md:2427); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
  - must_have: "The page lists the carried fields with protocolVersion, tasks, exposeResources, and caFile, and says why caFile can only narrow trust (09-05 truth 4)"
    reason: "Recorded decision D-PG9-14 (PROJECT.md:2429, 09-CONTEXT.md:141-169) withdraws `can only narrow trust`: at its origin the entry trusts exactly the bundle (pi-mcp-adapter 7.0.1 http-ca.ts). docs/mcp-compatibility.md:381 lists all four carried fields, and :383 states the exact-trust rule and the same-origin carry."
    accepted_by: "project decision D-PG9-14 (PROJECT.md:2429); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
  - must_have: "The disable and enable choice store, the uninstall restore, and the override-kept notice follow the carried set with no other change: userCarriedFields returns the four (09-04 truth 4)"
    reason: "Recorded decision D-PG9-14 (PROJECT.md:2429): the D-08-02 choice store records no url, so it keeps no caFile (leavingChoice, bridges/mcp/adapter-doc.ts:537-546), and a disable, uninstall, or dropped server reports ca-file-removed with reason entry-removed (shared/notification-mcp.ts:115-116; features/mcp-server/lifecycle.feature:858). The rest holds as planned: userCarriedFields returns all four (adapter-entry.ts:408-410, test `D-PG9-05: returns the user's protocolVersion, tasks, exposeResources, and caFile in carried-set order`), restoredOverride takes each live value (test `D-PG9-05: each kept protocolVersion, ...`), and an absorbed override's caFile becomes active on an https entry (test `D-PG9-05: an absorbed override's protocolVersion, tasks, exposeResources, and caFile become active ...`); all passed here."
    accepted_by: "project decision D-PG9-14 (PROJECT.md:2429); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
  - must_have: "A defaultFields that holds a null, an object, or an array value reads as absent, so each value of the entry reads as the user's (09-02 truth 2)"
    reason: "Recorded decision: the D-PG9-03 addition (09-CONTEXT.md:79-87, pending list :282-284). A malformed marker member of the staging plugin's own entry refuses mcp-adapter.json with McpConfigFileError marker-not-valid and leaves the bytes unchanged (assertOwnedMarkersReadable, bridges/mcp/adapter-doc.ts:244-260, called at stage.ts:467 and unstage.ts:107; scenario features/mcp-server/lifecycle.feature:507), following the project rule to fail closed on corrupt data. The parse itself still reads such a member as absent and never throws (bridges/mcp/marker.ts:59-67, :86-95; 19 `D-PG9-03:` marker cases passed here)."
    accepted_by: "project decision D-PG9-03 addition (09-CONTEXT.md:79-87); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
re_verification:
  previous_status: passed
  previous_score: "9/9 (5 roadmap criteria verified, 4 plan truths by proposed override)"
  previous_verified: 2026-11-15T02:10:00Z
  reason: "staleness: init.manager reported CHANGELOG.md and docs/mcp-compatibility.md changed after the previous report. `git diff --stat 14931522 HEAD` over its covered files shows 35 changed files, all from the later Phase 10 and 11 work and the gaps-agents/gaps-mcp merges (17d7bae4, 24de427b). In phase source, only additive Phase 10 edits landed: the per-plugin encoder parameter of stampServers (473689c1, D-PG10-11), option-blocked servers left out at stage (cdc8141c, f790ce66, 2f8e1541, D-PG10-21), and the caFile origin read with option values (D-PG10-23). No phase 9 planning artifact changed."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  score_correction: "The previous score counted the five roadmap criteria and four overridden plan truths. This pass checks all 36 plan truths. Three restate a criterion and are folded into it (09-01 truth 6 into criterion 3, 09-04 truth 1 into criterion 2, 09-05 truth 5 into criterion 4), so the denominator is 5 + 33 = 38."
  overrides_kept:
    - "Override 1, D-PG9-07 as amended: kept and widened to 09-03 truths 5 and 6 and 09-04 truth 6, which also name the withheld openUi default"
    - "Override 2, D-PG9-14 (caFile trust wording): kept"
    - "Override 3, D-PG9-14 (choice store keeps no caFile): kept"
    - "Override 4, D-PG9-03 addition (malformed marker member refuses the file): kept"
  overrides_basis: "The previous report called all four overrides proposed and accepted them as the orchestrator's. Each now rests on a recorded decision: D-PG9-07 (PROJECT.md:2427), D-PG9-14 (PROJECT.md:2429, recorded by 32557c7c), and the D-PG9-03 addition (09-CONTEXT.md:79-87, recorded by 32557c7c). The maintainer review of 2026-11-16 confirmed all three."
  overrides_added: []
  overrides_removed: []
  advisory_resolved: "The previous advisory (09-SECURITY.md audited before the review-fix rounds) is closed: 976c4786 re-audited the register at 25caef67 (09-SECURITY.md:109). T-09-05 now records the marker-not-valid refusal (:51), and T-09-15/AR-09-05 record the D-PG9-14 narrowing (:61, :79)."
prohibitions_flagged: 7
prohibition_review: "NON-AUTHORITATIVE; unverified-prohibition — human review recommended. The seven judgment-tier prohibitions of plans 09-03 to 09-06 were re-read against the current tree, and no violation was found (see the Prohibitions section). Following the Phase 1 re-verification (660e6da6), they are flagged here and listed under Maintainer Review, not as new manual tests."
human_verification: []
---

# Phase 9: Adapter Entries and MCP Features Verification Report

**Phase Goal:** Under pi-mcp-adapter, the entry this project writes for a plugin server keeps a stdio server running for the session, keeps what the user wrote on it, and gives the server only the powers the maintainer decides it may have. The MCP compatibility page says what a plugin server can use beyond tools under each implementation.

**Verified:** 2026-11-16T07:44:06Z
**Status:** passed, with 7 flagged judgment-tier prohibitions. All five roadmap criteria hold as written on the current tree. Of the 33 separate plan truths, 24 hold as written and 9 pass by one of four overrides. Each override now rests on a recorded decision (D-PG9-07 as amended, D-PG9-14, the D-PG9-03 addition), and the maintainer review of 2026-11-16 confirmed each decision.
**Re-verification:** Yes. The previous report (passed, 9/9, four proposed overrides, commit 14931522) became stale because later work changed covered files.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `328266f5`. It did not reuse the earlier verdicts, and summaries were not taken as evidence. For each truth, the implementing code, its callers, and the scenario or test that exercises it were read again. Citations are current line numbers. **B/** means `extensions/pi-claude-marketplace/bridges/mcp/`, **D/** means `extensions/pi-claude-marketplace/domain/`, **L/** means `features/mcp-server/lifecycle.feature`, and **M/** means `docs/mcp-compatibility.md`.

What changed since the previous report: the phase passages of M/ kept their place in the lifecycle, features-beyond-tools and user-override sections (:139-174, :379-395), and the divergence list moved from :657-661 to :756-759 because Phase 10 and 11 text was added above it. Phase 10 added the D-PG10-23 sentence about option values in the caFile origin, outside the phase passages. In CHANGELOG.md, the four phase 9 sub-bullets are intact at :39-42, and the lines added around them come from Phases 5-8, 10 and 11. In L/, the addition of the D-PG10-21 scenario (:763) moved every later phase scenario. B/adapter-entry.ts gained only the `encoder` input of `stampServers` (473689c1, D-PG10-11). The carried set, the defaults, the caFile rule and the marker are unchanged.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). The unpaired and integration tests passed with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1 and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`, on Node v26.13.1. The adapter cucumber profile ran 2098/2098 scenarios and 25964/25964 steps (seed 700460), so every `@adapter-only` and `@mcp` phase scenario ran. The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 547387), which includes the `@builtin-only` resource guard. Direct coverage merged 374 LCOV records. The log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD. The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass):** 16 named test groups, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '<name>' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. All passed (see Behavioral Spot-Checks). `query verify.artifacts` gives 4/4, 3/3, 4/4, 3/3, 2/2, 4/4 and `query verify.key-links` gives 3/3, 2/2, 3/3, 2/2, 2/2, 2/2 for plans 09-01 to 09-06, each with exit 0. The files of each commit that the summaries cite were listed with `git show --name-only` to check each plan's file scope.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 9 must-haves |
| --- | --- | --- |
| D-PG9-07 as amended (7b7bf951, PROJECT.md:2427, confirmed by the maintainer review 2026-11-16) | No `openUi: false` default is written, because pi-subagents 0.88.1 hashes no `openUi` (D/mcp-server-features.ts:87-90, :111-116). | Every plan clause that names the openUi default passes by override 1. Criterion 5 holds through its recorded-decision branch. |
| D-PG9-14 (review fix, PROJECT.md:2429, confirmed by the maintainer review 2026-11-16) | A carried `caFile` stays only while the entry stays https at the same `URL.origin`. The choice store keeps no `caFile`. A drop shows `MCP server caFile removed.` (B/adapter-entry.ts:378-401, B/adapter-doc.ts:534-546). | Overrides 2 and 3. Criterion 2 holds as written, because its update scenario keeps the origin (L/:638). |
| D-PG9-15 (review fix, PROJECT.md:2430, confirmed by the maintainer review 2026-11-16) | A user `idleTimeout` other than `null` counts as the user's lifecycle, so no lifecycle default is written beside it (`userHolds`, B/adapter-entry.ts:484-486). | Refines criterion 1 and 09-03 truth 4 (the user's choice wins). Scenarios L/:1005, :1076. |
| D-PG9-16 (review fix, PROJECT.md:2431, confirmed by the maintainer review 2026-11-16) | Records the background restart of a crashed stdio server as a divergence (M/:147, :757). | Documentation only. No must-have changes. |
| D-PG9-03 addition (09-CONTEXT.md:79-87, confirmed by the maintainer review 2026-11-16) | A malformed marker member of the plugin's own entry refuses the file (fail closed). | Override 4. The parse still never throws. |
| D-PG10-11/-21/-23 (Phase 10) | Per-plugin encoder passed to `stampServers`; a server that names an unset option is left out (L/:763); the caFile origin is read with option values. | Additive. Defaults, carried set, marker and caFile rule are unchanged. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | The adapter entry written for a stdio plugin server holds `lifecycle: "lazy-keep-alive"`, a remote server's entry stays `lazy`, and a lifecycle the user set on the entry is kept (PG-MCP-06) | ✓ VERIFIED | `transportKind` (D/mcp-server-features.ts:69-80: no type or `stdio` gives stdio; `sse`, `http`, `streamable-http` give remote). The frozen table gives stdio `lifecycle: "lazy-keep-alive"` and remote only `requestTimeoutMs` (:87-90). `adapterEntryDefaults` (:118-123). `defaultFieldsFor` (B/adapter-entry.ts:493-507) fills a default only when neither the translated entry nor the user holds the field. `lifecycle` is carried (:67). Scenarios: configuration.feature:64 pins the whole file (plain and typed stdio hold the lifecycle; sse and streamable-http hold none). L/:933: a user `lifecycle: "lazy"` survives an update next to a server that keeps the default. L/:470: a change from stdio to remote drops the default. In Gate G. |
| 2 | A user's `protocolVersion: "auto"` on a plugin entry is still there after `/claude:plugin update` and after a reinstall, and so is a user's `tasks`, `exposeResources`, or `caFile` (PG-MCP-09) | ✓ VERIFIED | `CARRIED_FIELDS` ends with the four fields (B/adapter-entry.ts:62-80). `carriedFields` (:236-257) copies each own carried field that is not plugin-set and is not a recorded default. L/:638 pins all four after an update that changes the url path, and L/:683 after a reinstall. L/:721 keeps a `caFile` across a reinstall when the url starts with a variable. The marker records none of the four (test `D-PG9-05: a restage keeps ... and records none of them`, passed). D-PG9-14 narrows the caFile carry to the same https origin (L/:878, :816, :858). The criterion does not cover those cases. Folds 09-04 truth 1. |
| 3 | Under each profile, a scenario reads a resource of a plugin server (PG-MCP-08) | ✓ VERIFIED | features/mcp-server/resources.feature:8 (`@adapter-only`): the model calls `mcp` with `mcp__plugin_demo_stub__read_notes`, and the tool result is `mcp returned: stub notes` (:30). Line :33 (`@builtin-only`): `tool_search`, then `read_mcp_resource {"server":"plugin_demo_stub","uri":"stub://notes"}` returns `stub notes` (:58-59). Each ran in its profile in Gate G. These are regression guards, as the roadmap note says. Folds 09-01 truth 6. |
| 4 | `docs/mcp-compatibility.md` states, for each implementation, whether a plugin server can use resources, prompts, elicitation, sampling, roots, and output limits, and says that `@server:uri` mentions do not exist on Pi (PG-MCP-08) | ✓ VERIFIED | Section `## Features beyond tools` at M/:157. The table at :161-168 has columns for Claude Code 2.1.323, pi-mcp-adapter 7.0.1 and Pi built-in 1.5.0, and rows for Resources :163, Prompts :164, Elicitation :165, Sampling :166, Roots :167 and Output limits :168. Each cell names a scenario or a source, and each cell that no scenario backs says unmeasured. M/:172: "`@server:uri` mentions do not exist on Pi, under either implementation." Folds 09-05 truth 5. |
| 5 | Under the adapter, a plugin server's entry holds the fields that withhold `sampling` and the MCP UI extension, or the compatibility page cites the recorded decision that accepts the divergence (PG-SEC-03) | ✓ VERIFIED (the "or" branch) | Sampling: M/:166 and :758 cite D-PG9-08, which PROJECT.md:2428 records with its premise, pi-mcp-adapter 7.0.1 and Claude Code 2.1.323. UI: M/:174 and :759 cite D-PG9-07 as amended, which PROJECT.md:2427 records with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1 and its reason, a Pi-companion capability gap. Carriers: BACKLOG.md:5470 (MCPSAMPLING-01) and :5474 (MCPOPENUI-01), and the draft `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`. No `openUi` default is written (test `D-PG9-07: no transport's defaults hold openUi`, passed). The maintainer review of 2026-11-16 locked both decisions. |

### Plan Truths (those that restate a criterion are folded into it)

| Plan | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 09-01 | The adapter listing wait ends once the stub logged its `tools/list` and either no stub runs or Pi's registry holds a tool of the server (D-PG9-01) | ✓ VERIFIED | `listingDone` (features/lib/mcp-implementation.ts:494-511) and `waitForStubListing` (:519-544). Every lifecycle scenario now runs a kept-alive stdio entry and passed in Gate G. |
| 09-01 | A tool of the server is a prefixed name, or, with no prefix, the full name the implementation gives a logged tool, so the 56-character server with tool `deadbeef` is still found | ✓ VERIFIED | `hasStubTool` (mcp-implementation.ts:469-484) branches on `toolNamePrefix`. The logged `tool` member is at features/lib/mcp-stub-server.ts:51, and `listedTools` is at :114-125. features/hook/mcp-tool-names.feature:145-154 passed in Gate G. |
| 09-01 | The hook listing step reaches the same wait; no copy of the rule is left in a step module | ✓ VERIFIED | features/step_definitions/hook/tool-use.steps.ts:39 imports `waitForStubListing` and :336 calls it. listing.steps.ts:151 calls it too. Neither module holds its own rule (key link verified). |
| 09-01 | Every listing feature passes under both profiles, and a temporary resident-stub run shows no listing-wait failure, recorded in the SUMMARY with no file left changed | ✓ VERIFIED | 09-01-SUMMARY.md:71-97: run on top of f0e8979c, 180 scenarios, **0** listing-wait failures, 17 expectation failures later re-pinned by 09-03, and `git diff --quiet` exits 0. Both profiles pass in Gate G. |
| 09-01 | A stub with the resource variable declares `resources` and offers one text resource; without it, the stub answers as before | ✓ VERIFIED | mcp-stub-server.ts:9-12, :41 (`STUB_RESOURCE`), :159 (the capability only when the resource is set), :164-180, :213-216. The default adapter tables are unchanged by 012c23bc (invocation.feature:29-32 shows tools only). |
| 09-02 | `defaultFields` reads as an own plain object of numbers, strings or booleans, and a numbers-only marker still reads (D-PG9-03) | ✓ VERIFIED | `isDefaultValue` and `isDefaultRecord` (B/marker.ts:59-67), `readMarker` (:86-95). 19 `D-PG9-03:` and 9 `D-PG1-13:` marker cases passed. |
| 09-02 | A malformed `defaultFields` reads as absent; reading never throws | PASSED (override) | Override 4 (D-PG9-03 addition). The parse clause holds. A stage or unstage refuses the file (L/:507). |
| 09-02 | `buildMarker` writes a string or boolean default after `pluginSetFields` and before `keptOverride`, and no member for an empty record | ✓ VERIFIED | B/marker.ts:166-183. Tests `D-PG9-03: writes string and boolean defaults after plugin-set fields and before the kept override` and `D-PG1-13: omits default fields when the record is empty`, passed. |
| 09-02 | The 0.23.0 fixture writes an entry with no `requestTimeoutMs`, `lifecycle` or `openUi` and no `defaultFields`; the D-PG1-12 reinstall scenario uses it (D-PG9-04) | ✓ VERIFIED | `writeRelease0230McpAdapterEntry` (features/lib/mcp-server-files.ts:369-392) deletes both defaults and the marker's `defaultFields`. No release writes `openUi`, so the entry holds none. Given at lifecycle.steps.ts:63-70. Used by L/:601 (D-PG1-12 in its title). |
| 09-02 | No product output changes beyond the flipped marker cases | ✓ VERIFIED | bd2643fd and 8424da36 touch only B/marker.ts, B/adapter-entry.ts (the type of `isRecordedDefault`, :227-234), the marker test, and the 0.23.0 fixture with its feature and steps. |
| 09-03 | A stdio entry holds `lifecycle` and `openUi: false` after `requestTimeoutMs`, and the marker records all three | PASSED (override) | Override 1 (D-PG9-07 as amended). Timeout then lifecycle, both recorded: configuration.feature:64-148. |
| 09-03 | A remote entry holds `openUi: false` and no `lifecycle` (D-PG9-02) | PASSED (override) | Override 1. The no-lifecycle half holds (configuration.feature, `plugin_demo_events_` and `plugin_demo_stream_`). |
| 09-03 | Neither default is plugin-set: the closed table writes no `lifecycle` and no `openUi`, no entry lists them in `pluginSetFields`, built-in registrations do not change | ✓ VERIFIED | Test `ANAME-07 / D-PG9-01: the closed table writes no lifecycle and no openUi, even when the plugin declares them`, passed. The built-in translation still reads only `defaultRequestTimeoutMs` (D/mcp-builtin-translation.ts:24, :85; key link verified). |
| 09-03 | A user `lifecycle` or `openUi` wins and is not recorded; a recorded default is recomputed; stdio to remote loses the lifecycle default (D-PG9-03) | ✓ VERIFIED | `isRecordedDefault` (B/adapter-entry.ts:227-234), `userHolds` (:484-486). Tests `D-PG9-03: the user's lifecycle and openUi carry ...` and `D-PG1-13 / D-PG9-03: recomputes the recorded stdio defaults ...`, passed. Scenarios L/:933 and :470. |
| 09-03 | One adapter `initialize` before the first `tools/call` where the listing ran in the session; no `initialize` declares the MCP Apps UI extension; `sampling`, `roots`, `elicitation` stay declared; tables re-pinned from a recorded run | PASSED (override) | Override 1 covers the UI clause: the rows still declare `io.modelcontextprotocol/ui`. The rest holds: invocation.feature:29-32 has one `initialize`, then `tools/list` and `tools/call`, with `sampling`, `roots` and `elicitation`. The re-pins were run in 6340989e. |
| 09-03 | A 0.23.0 entry gets all three defaults at the next reinstall, and a disable then enable writes them again (D-PG9-04) | PASSED (override) | Override 1 covers "three". The two remaining defaults: L/:601 (reinstall) and L/:564 (disable then enable). |
| 09-03 | No load writes a new default except the AMIG-01 move; no orchestrator file changes | ✓ VERIFIED | The 09-03 commits 581c2f5e, 6340989e, 7b7bf951 and 99680c6d touch no `extensions/.../orchestrators/` file (tests under `test/orchestrators/` only). The defaults live in the stage path (`stampServers`, B/adapter-entry.ts:525-569). |
| 09-04 | A caFile the user wrote survives an update that changes the server's url (D-PG9-05) | ✓ VERIFIED | L/:638 changes the url path at the same origin and keeps the `caFile`. Test `D-PG9-14: a caFile survives a url change at the same https origin, whatever the case of the origin`, passed. D-PG9-14 limits this to the same origin. |
| 09-04 | A plugin cannot set the four fields: the closed table drops them and no entry lists them in `pluginSetFields` | ✓ VERIFIED | Test `AFILE-06: of every ServerEntry key, only the carried keys take their previous values and the plugin's adapter-only values are dropped`, passed (fixture with the four previous values at test/bridges/mcp/adapter-entry.test.ts:1276-1279). `pluginSetFieldsIn` takes only fields the translated entry holds (B/adapter-entry.ts:213-215). |
| 09-04 | The choice store, the uninstall restore and the override-kept notice follow the carried set; `userCarriedFields` returns the four | PASSED (override) | Override 3 (D-PG9-14). |
| 09-04 | No credential-bearing field joins the carried set; an absorbed override's credential fields stay inside the marker | ✓ VERIFIED | `CARRIED_FIELDS` (B/adapter-entry.ts:62-80) holds no `env`, `headers`, `oauth`, `auth` or bearer field. Test `AFILE-06: an absorbed override's credentials stay inside the marker and only carried fields become active`, passed. |
| 09-04 | A user `lifecycle` and `openUi` survive an update beside a server with the three recorded defaults (D-PG9-03) | PASSED (override) | Override 1 covers "three". L/:933-1003: `plugin_demo_kept_` keeps `lifecycle: "lazy"` and `openUi: true`, and `plugin_demo_plain_` holds the two recorded defaults. |
| 09-05 | The page says this extension writes `lazy-keep-alive` on stdio entries and none on remote ones, what it does under 7.0.1, that a user's lifecycle wins, and when an installed plugin gets the default | ✓ VERIFIED | M/:143 (written for stdio, none for remote, D-PG9-01 and D-PG9-02), :145 (what `lazy-keep-alive` does in 7.0.1), :151 (the user's value wins, D-PG9-03), :153 (at the next restage, not at an update with no new revision, not at a load, D-PG9-04). |
| 09-05 | The page says every plugin entry gets `openUi: false` unless the user set it | PASSED (override) | Override 1. The page states the withheld default instead (M/:174, :385, :759). |
| 09-05 | The page says pi-mcp-adapter 7.0.1 still declares `sampling` to every plugin server and cites D-PG9-08 with its reason | ✓ VERIFIED | M/:166 (`Yes, for every server ... This is a divergence (D-PG9-08)`), and :758 (`Reason: a pi-mcp-adapter capability gap (D-PG9-08 ...)`). |
| 09-05 | The page lists the four carried fields and says why `caFile` can only narrow trust | PASSED (override) | Override 2 (D-PG9-14). |
| 09-05 | `docs/output-catalog.md` describes the resting status of a lazy or lazy-keep-alive server, lists the carried fields as the code holds them, and leaves its example blocks unchanged | ✓ VERIFIED | docs/output-catalog.md:3085 (resting states) and :5318 (the 17 carried fields in `CARRIED_FIELDS` order). c7dfbe44 changes these two prose lines only. |
| 09-06 | PROJECT.md holds rows for D-PG9-01, -07 and -08, each with decision, premise, version, and outcome `Pending maintainer review` | ✓ VERIFIED | PROJECT.md:2426-2428: pi-mcp-adapter 7.0.1 in each row, Claude Code 2.1.323 in the -07 and -08 rows, and each outcome cell `Pending maintainer review`.. Since then, the maintainer review of 2026-11-16 locked the three rows, so each outcome cell now reads `-- Locked (maintainer review 2026-11-16, ...)`. |
| 09-06 | The D-PG9-01 row says it amends ANAME-05 and names the "no" alternative (PG-MCP-06 to Out of Scope) | ✓ VERIFIED | PROJECT.md:2426: the title holds `amends ANAME-05`, and the body says `A "no" moves PG-MCP-06 to Out of Scope`. |
| 09-06 | The D-PG9-08 row licenses the divergence by a pi-mcp-adapter capability gap and names the draft and the BACKLOG entry | ✓ VERIFIED | PROJECT.md:2428 names `.planning/upstream/pi-mcp-adapter-per-server-sampling.md` and MCPSAMPLING-01. |
| 09-06 | The upstream draft exists in the shape of the existing drafts and is not filed | ✓ VERIFIED | `.planning/upstream/pi-mcp-adapter-per-server-sampling.md:1-5` (`Patch: no patch exists; this report is not filed.`, Repository, Package version), the same header as `pi-subagents-long-tool-names.md`. |
| 09-06 | BACKLOG MCPSAMPLING-01 names its trigger and the draft's path | ✓ VERIFIED | BACKLOG.md:5470-5472. |
| 09-06 | CHANGELOG has a sub-bullet under the parity-gaps entry of `[Unreleased]` that says what adapter users see and to run `/claude:plugin reinstall` once; no version file changes | ✓ VERIFIED | CHANGELOG.md:39 under `## [Unreleased]` (:3). b5644587 touches only CHANGELOG.md. Lines :40-42 were added later by the review fixes (D-PG9-16, -15, -14). |

**Score:** 38/38 (29 VERIFIED, 9 PASSED (override); 0 present, behavior-unverified)

### Prohibitions (judgment tier, flagged)

All seven are `verification: judgment`, none is test-tier. These verdicts are non-authoritative LLM judgments: **unverified-prohibition — human review recommended**.

| Plan | Prohibition | Non-authoritative verdict and evidence |
| --- | --- | --- |
| 09-03 | MUST NOT replace a user `lifecycle` or `openUi` with a default at any restage (PG-MCP-06) | Holds. `userHolds` and `defaultFieldsFor` (B/adapter-entry.ts:484-507). L/:933. Unit cases `D-PG9-03:` and `D-PG9-15:` passed. |
| 09-03 | MUST NOT write pi-mcp-adapter's global `settings.sampling` or any member outside the plugin's own entries (PG-SEC-03) | Holds. No `.ts` file under `extensions/pi-claude-marketplace/` names `sampling`. The one top-level member the extension writes, `_piClaudeMarketplace.serverChoices`, predates the phase (D-08-02). |
| 09-04 | MUST NOT add a credential-bearing field to the carried set (PG-MCP-09) | Holds. `CARRIED_FIELDS` (B/adapter-entry.ts:62-80). The absorbed-override credential test passed. |
| 09-05 | MUST NOT say or imply that this extension withholds `sampling` under 7.0.1 (PG-SEC-03) | Holds. M/:166 says `Yes, for every server`, and :758 says the extension does not write the global setting. |
| 09-05 | MUST NOT describe a cell as measured unless a scenario or recorded run of this repository backs it (PG-MCP-08) | Holds. Each `Measured:` cell in M/:163-168 names resources.feature or invocation.feature. Prompts and output limits say unmeasured. |
| 09-06 | MUST NOT record D-PG9-01, -07 or -08 as locked or as a maintainer decision (PG-SEC-03) | Holds. PROJECT.md:2426-2431: each title says `pending maintainer review`, and each outcome is `Pending maintainer review`. The prohibition bound the autonomous run. The maintainer review of 2026-11-16 has since locked the rows, which is the maintainer's decision the prohibition left open. |
| 09-06 | MUST NOT tell the reader that installed plugins change by themselves (PG-MCP-06) | Holds. CHANGELOG.md:39: `Run /claude:plugin reinstall once to apply this to an installed plugin.` |

## Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| D/mcp-server-features.ts | ✓ VERIFIED | Defaults table :87-90, `adapterEntryDefaults` :118-123. Imported by B/adapter-entry.ts:23 and B/marker.ts:20. |
| B/adapter-entry.ts | ✓ VERIFIED | Carried set :62-80, `carriedFields` :236-257, `appliedCarriedFields` :378-401, `userCarriedFields` :408-410, `restoredOverride` :445, `defaultFieldsFor` :493-507, `stampServers` :525-569. |
| B/marker.ts | ✓ VERIFIED | Scalar defaults :59-67, `malformedMarkerMember` :146, `buildMarker` :166-183, `defaultFieldsOf` :214-218. |
| B/adapter-doc.ts | ✓ VERIFIED | `assertOwnedMarkersReadable` :244-260 (called at stage.ts:467 and unstage.ts:107), `leavingChoice` :537-546. |
| features/lib/mcp-implementation.ts, mcp-stub-server.ts, mcp-server-files.ts | ✓ VERIFIED | Listing rule, logged tool, opt-in resource, 0.23.0 fixture (see the plan rows). |
| features/mcp-server/resources.feature, configuration.feature, L/ | ✓ VERIFIED | :8 and :33; :64; the phase scenarios at L/:470, :507, :564, :601, :638, :683, :721, :816, :858, :878, :933, :1005, :1076. |
| M/ and docs/output-catalog.md | ✓ VERIFIED | M/:139-174, :379-395, :756-759; catalog :3085, :5304, :5318, :5370. |
| PROJECT.md rows, BACKLOG entries, upstream draft, CHANGELOG | ✓ VERIFIED | PROJECT.md:2426-2431; BACKLOG.md:5470, :5474; the draft; CHANGELOG.md:39-42. |

## Key Link Verification

`query verify.key-links`: 3/3, 2/2, 3/3, 2/2, 2/2, 2/2 (09-01 to 09-06). Manual trace: `stampServers` (B/adapter-entry.ts:525) -> `appliedCarriedFields` (:542) -> `defaultFieldsFor` (:552) -> `adapterEntryDefaults` (:503) -> `buildMarker(..., { pluginSetFields, defaultFields, keptOverride })` (:560). The previous record comes back through `defaultFieldsOf` in `carriedFields` (:243). The update row maps `McpConfigFileError` to `unreadable` (orchestrators/plugin/update-flow.ts:979). L/:507 pins the `unreadable` row.

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| --- | --- | --- | --- | --- |
| Written `mcp-adapter.json` entries | defaults, carried fields, marker | the plugin's `.mcp.json` translated, the previous entry, the defaults table | Yes. configuration.feature:64 and L/ pin the exact file text | ✓ FLOWING |
| `MCP server caFile removed.` rows | `caFileRemoved` | `appliedCarriedFields` and the unstage removal | Yes. L/:858 and :878 assert the rows | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each reported `fail 0`.

| ID | Named test (pattern) | File | Result |
| --- | --- | --- | --- |
| M1 | `^adapterEntryDefaults$` | test/domain/mcp-server-features.test.ts | PASS (10/10) |
| M2 | `^D-PG9-07: no transport` | same | PASS (1/1) |
| M3 | `^ANAME-07 / D-PG9-01: the closed table writes no lifecycle and no openUi` | same | PASS (1/1) |
| M4 | `^defaultRequestTimeoutMs$` | same | PASS (6/6) |
| K1 | `^D-PG9-03: ` | test/bridges/mcp/marker.test.ts | PASS (19/19) |
| K2 | `^D-PG1-13: ` | same | PASS (9/9) |
| A1 | `^D-PG9-05: ` | test/bridges/mcp/adapter-entry.test.ts | PASS (4/4) |
| A2 | `^D-PG9-03: ` | same | PASS (4/4) |
| A3 | `^D-PG9-02 / D-PG9-07: ` | same | PASS (1/1) |
| A4 | `^D-PG1-13 / D-PG9-03: ` | same | PASS (1/1) |
| A5 | `^D-PG9-14: ` | same | PASS (27/27) |
| A6 | `^D-PG9-15: ` | same | PASS (6/6) |
| A7 | `^AFILE-06: an absorbed override's credentials stay inside the marker` | same | PASS (1/1) |
| A8 | `^D-08-02: ` | same | PASS (3/3) |
| A9 + K3 | `^AFILE-06: of every ServerEntry key` and `^malformedMarkerMember$` | adapter-entry and marker tests | PASS (11/11) |
| G | `npm run check` at `1183aae3` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

## Probe Execution

Not applicable. No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` exists. The resident-stub run of 09-01 was a recorded, uncommitted measurement, and its record is the evidence.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-MCP-06 | 01, 02, 03, 04, 05, 06 | ✓ SATISFIED | Criterion 1. REQUIREMENTS.md:59 `[x]`, trace :200 Complete |
| PG-MCP-09 | 04, 05, 06 | ✓ SATISFIED (caFile narrowed by D-PG9-14) | Criterion 2. REQUIREMENTS.md:61 `[x]`, trace :202 Complete |
| PG-MCP-08 | 01, 05 | ✓ SATISFIED | Criteria 3, 4. REQUIREMENTS.md:60 `[x]`, trace :201 Complete |
| PG-SEC-03 | 02, 03, 04, 05, 06 | ✓ SATISFIED through the recorded divergences D-PG9-07 (amended) and D-PG9-08, both locked by the maintainer review 2026-11-16 | Criterion 5. REQUIREMENTS.md:82 `[x]`, trace :214 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 9, and each appears in plan frontmatter. Since the previous report, the four checkboxes have moved from Pending to `[x]`.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| D/mcp-server-features.ts, B/adapter-entry.ts, B/marker.ts, B/adapter-doc.ts, mcp-implementation.ts, mcp-stub-server.ts, resources/lifecycle/configuration features | TBD / FIXME / XXX / TODO / HACK | None | No match |
| features/mcp-server/*.feature | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- **Stale roadmap plan line.** ROADMAP.md:471 still describes 09-03 as writing "`openUi: false` for every plugin server". Criterion 5 and the code follow the D-PG9-07 amendment. The plan line should be amended with it, or when the maintainer settles D-PG9-07.
- `test/integration/pi-subagents-child-identity.test.ts`, which M/:759, PROJECT.md:2427 and BACKLOG.md:5474 cite for the openUi measurement, never names `openUi`. The citation records a run in which the test failed with the default written, not an assertion in the file. That is accurate, but no committed test pins it.
- The previous report cited M/:657-661, L/:468, :505, :562, :599, :636, :681, :719, :761, :803, :823, :878, :950, :1021, and adapter-entry.ts:487-509 and :551. Later additions moved them to the lines above. The content is the same.
- Outside this phase: CHANGELOG.md:37 (a Phase 8 line) still says the engine runs a default agent "where Claude Code stops the run". The Phase 8 note text says Claude Code "fails the step" (review fix WR-02). The Phase 8 re-verification did not cover CHANGELOG.md.

## Human Verification Required

None. The judgment-tier prohibitions are flagged above and listed under Maintainer Review, following the Phase 1 re-verification (660e6da6). The remaining items are maintainer decisions, not tests.

## Maintainer Review

The maintainer review of 2026-11-16 answered items 1 to 7: each decision is locked as confirmed (D-PG9-07 with the `openUi` default deferred to MCPOPENUI-01). Item 8 stays a recommendation. None is a gap:

1. **D-PG9-01 / D-PG9-04** (PROJECT.md:2426): `lazy-keep-alive` for stdio plugin servers. Existing installs get it only at their next restage. The alternatives are `keep-alive`, or moving PG-MCP-06 to Out of Scope.
2. **D-PG9-07 as amended** (PROJECT.md:2427): no `openUi` default until pi-subagents hashes `openUi` (MCPOPENUI-01). Override 1 depends on it. If the maintainer rejects it, T-09-09 reopens as a high blocker (09-SECURITY.md:55, :109).
3. **D-PG9-08** (PROJECT.md:2428): the sampling divergence, and whether to file the drafted upstream request.
4. **D-PG9-14** (PROJECT.md:2429): the same-origin `caFile` rule, no `caFile` in the choice store, the `entry-removed` notice, and the stub write-back residual. Overrides 2 and 3 depend on it.
5. **D-PG9-15** (PROJECT.md:2430): any user `idleTimeout` other than `null` replaces the lifecycle default.
6. **D-PG9-16** (PROJECT.md:2431): the background restart of a crashed stdio server, a divergence that no scenario has measured.
7. **D-PG9-03 addition** (09-CONTEXT.md:79-87): a malformed marker member refuses the file (fail closed), and an update reports it as `{unreadable}`. Override 4 depends on it.
8. **Seven flagged judgment-tier prohibitions** (see Prohibitions): the verifier's non-authoritative verdict is that all seven hold. Human review recommended.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria and all 33 counted plan truths of Phase 9 hold, 9 of the truths by override, and every citation points at a current line. Later work touched the phase only additively. Phase 10 passes a per-plugin encoder into `stampServers`, leaves out a server that names an unset option, and reads the caFile origin with option values. Phases 10 and 11 added text to the compatibility page and the CHANGELOG around the phase passages, which stay intact.

Checking the plan truths one by one found nine clauses that do not hold as written. None is a regression: each was changed in the phase by a decision that is now recorded. The D-PG9-07 amendment withheld the `openUi` default, which affects six truths. D-PG9-14 narrowed the `caFile` carry and withdrew the "narrow trust" wording, which affects two. The D-PG9-03 addition made a malformed marker member refuse the file, which affects one. The four existing overrides cover them. This pass widened override 1 to name all six openUi clauses, and it records the decision each override rests on in place of "proposed". The score moves from 9/9 to 38/38, because this pass counts every plan truth. The previous advisory on the security register is resolved (976c4786).

---

_Verified: 2026-11-16T07:44:06Z_
_Verifier: Claude (gsd-verifier)_
