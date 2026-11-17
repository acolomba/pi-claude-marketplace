---
phase: 09-adapter-entries-and-mcp-features
verified: 2026-11-17T03:57:54Z
status: passed
score: 38/38 must-haves verified (28 VERIFIED, 10 PASSED (override)); 7 judgment-tier prohibitions flagged
covered_files: [".planning/phases/09-adapter-entries-and-mcp-features/09-01-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-01-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-02-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-02-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-03-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-03-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-04-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-04-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-05-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-05-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-06-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-06-SUMMARY.md","CHANGELOG.md","docs/json-output.md","docs/mcp-compatibility.md","docs/output-catalog.md","extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/marker.ts","extensions/pi-claude-marketplace/bridges/mcp/stage.ts","extensions/pi-claude-marketplace/bridges/mcp/types.ts","extensions/pi-claude-marketplace/bridges/mcp/unstage.ts","extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts","extensions/pi-claude-marketplace/domain/mcp-server-features.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts","extensions/pi-claude-marketplace/shared/errors-bridges.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-json.ts","extensions/pi-claude-marketplace/shared/notification-mcp.ts","extensions/pi-claude-marketplace/shared/notification-resolve.ts","extensions/pi-claude-marketplace/shared/notification-types.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","features/hook/mcp-tool-names.feature","features/lib/hook-mcp-tool-server.ts","features/lib/mcp-implementation.ts","features/lib/mcp-server-files.ts","features/lib/mcp-stub-server.ts","features/mcp-server/companion-missing.feature","features/mcp-server/configuration.feature","features/mcp-server/invocation.feature","features/mcp-server/legacy-move.feature","features/mcp-server/lifecycle.feature","features/mcp-server/project-scope.feature","features/mcp-server/resources.feature","features/plugin/subagent-child.feature","features/step_definitions/hook/tool-use.steps.ts","features/step_definitions/mcp-server/lifecycle.steps.ts","features/step_definitions/mcp-server/listing.steps.ts","features/step_definitions/mcp-server/resources.steps.ts","features/step_definitions/mcp-server/verdict-settings.steps.ts","schema/claude-plugin.schema.json","test/architecture/integration-materialization-gate.test.ts","test/architecture/mcp-config-notices.test.ts","test/bridges/mcp/adapter-doc.test.ts","test/bridges/mcp/adapter-entry.test.ts","test/bridges/mcp/marker.test.ts","test/bridges/mcp/stage.test.ts","test/bridges/mcp/unstage.test.ts","test/domain/mcp-server-features.test.ts","test/integration/mcp-home-path-partial.test.ts","test/integration/mcp-legacy-sweep.test.ts","test/integration/mcp-override-lifecycle.test.ts","test/integration/mcp-variable-expansion.test.ts","test/orchestrators/marketplace/shared.test.ts","test/orchestrators/plugin/install-flow-ledger.test.ts","test/orchestrators/plugin/reinstall-flow.test.ts","test/orchestrators/plugin/update-flow.test.ts","test/orchestrators/plugin/update-swap.test.ts","test/orchestrators/reconcile/mcp-migration.test.ts","test/shared/errors-bridges.test.ts","test/shared/notification-json.test.ts","test/shared/notification-mcp.test.ts","test/shared/notification-resolve.test.ts"]
covered_digest: "v4:sha256:8c484feb3ba7e90eec61cddc64c43f2be3c14d46a160469ac6d03f419d39c933"
behavior_unverified: 0
overrides_applied: 5
overrides:
  - must_have: "The openUi default on every plugin server entry: 09-03 truths 1 and 2 (a stdio entry holds openUi false and its marker records all three defaults; a remote entry holds openUi false), the UI clause of 09-03 truth 5 (no initialize declares the MCP Apps UI extension), the `all three defaults` of 09-03 truth 6, the `three recorded defaults` of 09-04 truth 6, and 09-05 truth 2 (the page says every plugin entry gets openUi false)"
    reason: "Locked decision D-PG9-07 as amended during execution (PROJECT.md:2428, outcome `Locked (maintainer review 2026-11-16, confirmed; the default returns through BACKLOG MCPOPENUI-01)`; 09-CONTEXT.md:176; fix 7b7bf951): pi-subagents 0.88.1 computeMcpServerHash leaves out openUi, so an openUi false default makes the adapter tool cache read as stale and an agent with a plugin MCP grant cannot launch. The openUi default is withheld, the divergence is confirmed, and its return is tracked by BACKLOG MCPOPENUI-01 (BACKLOG.md:5480, confirmation :5484). No openUi default is written (domain/mcp-server-features.ts:87-90, :111-116; test `D-PG9-07: no transport's defaults hold openUi` passed here). Each truth holds for everything but openUi: stdio entries and the 0.23.0 reinstall hold the two remaining defaults, timeout and lifecycle, in that order (features/mcp-server/configuration.feature:64, features/mcp-server/lifecycle.feature:601, :933); the adapter initialize rows still declare io.modelcontextprotocol/ui (features/mcp-server/invocation.feature:29, :159, :190); the page states the withheld default and its reason (docs/mcp-compatibility.md:174, :385, :770). Roadmap criterion 5 takes its `or the page cites the recorded decision` branch, so only plan truths need this override."
    accepted_by: "project decision D-PG9-07 as amended (PROJECT.md:2427); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
  - must_have: "The page lists the carried fields with protocolVersion, tasks, exposeResources, and caFile, and says why caFile can only narrow trust (09-05 truth 4)"
    reason: "Locked decision D-PG9-14 (PROJECT.md:2430, outcome `Locked (maintainer review 2026-11-16, confirmed)`; 09-CONTEXT.md:141-169) withdraws `can only narrow trust`: at its origin the entry trusts exactly the bundle (pi-mcp-adapter 7.0.1 http-ca.ts). docs/mcp-compatibility.md:381 lists all four carried fields, and :383 states the exact-trust rule and the same-origin carry."
    accepted_by: "project decision D-PG9-14 (PROJECT.md:2429); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
  - must_have: "The disable and enable choice store, the uninstall restore, and the override-kept notice follow the carried set with no other change: userCarriedFields returns the four (09-04 truth 4)"
    reason: "Locked decision D-PG9-14 (PROJECT.md:2430): the D-08-02 choice store records no url, so it keeps no caFile (leavingChoice, bridges/mcp/adapter-doc.ts:537-546), and a disable, uninstall, or dropped server reports ca-file-removed with reason entry-removed (shared/notification-mcp.ts:115-116; features/mcp-server/lifecycle.feature:858). The rest holds as planned: userCarriedFields returns all four (adapter-entry.ts:431-433, test `D-PG9-05: returns the user's protocolVersion, tasks, exposeResources, and caFile in carried-set order`), restoredOverride takes each live value (test `D-PG9-05: each kept protocolVersion, ...`), and an absorbed override's caFile becomes active on an https entry (test `D-PG9-05: an absorbed override's protocolVersion, tasks, exposeResources, and caFile become active ...`); all passed here."
    accepted_by: "project decision D-PG9-14 (PROJECT.md:2429); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
  - must_have: "A defaultFields that holds a null, an object, or an array value reads as absent, so each value of the entry reads as the user's (09-02 truth 2)"
    reason: "Recorded decision: the D-PG9-03 addition (09-CONTEXT.md:79-87, listed for the maintainer at :282-284). A malformed marker member of the staging plugin's own entry refuses mcp-adapter.json with McpConfigFileError marker-not-valid and leaves the bytes unchanged (assertOwnedMarkersReadable, bridges/mcp/adapter-doc.ts:244-260, called at stage.ts:467 and unstage.ts:107; scenario features/mcp-server/lifecycle.feature:507), following the project rule to fail closed on corrupt data. The parse itself still reads such a member as absent and never throws (bridges/mcp/marker.ts:69-77, :90-108; 20 `D-PG9-03:` marker cases passed here). Since D-PG10-25 the same refusal also covers a malformed `withheld` member (marker.ts:141-149)."
    accepted_by: "project decision D-PG9-03 addition (09-CONTEXT.md:79-87); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:44:06Z"
  - must_have: "PROJECT.md holds rows for D-PG9-01, -07 and -08, each with decision, premise, version, and outcome `Pending maintainer review` (09-06 truth 1)"
    reason: "Locked decision rows D-PG9-01 (PROJECT.md:2427), D-PG9-07 (:2428) and D-PG9-08 (:2429). The plan wrote each outcome as `Pending maintainer review`, because the autonomous run could not decide for the maintainer. The rows still hold the decision, the premise and the versions (pi-mcp-adapter 7.0.1 in each, Claude Code 2.1.323 in -07 and -08), but each outcome cell now reads `-- Locked (maintainer review 2026-11-16, confirmed)`, with `; the default returns through BACKLOG MCPOPENUI-01` added on -07. 0401bac2 locked -01 and -08, and 567585d3 locked -07. The pending outcome the truth names is history, replaced by the decision it waited for."
    accepted_by: "locked decision rows D-PG9-01, D-PG9-07 and D-PG9-08 (PROJECT.md:2427, :2428, :2429)"
    accepted_at: "2026-11-17T03:57:54Z"
re_verification:
  previous_status: passed
  previous_score: "38/38 (29 VERIFIED, 9 PASSED (override))"
  previous_verified: 2026-11-16T07:44:06Z
  reason: "staleness: init.manager reported the phase stale after 421863f6 (`docs: align decision wording with the maintainer review`), which removed the `pending maintainer review` wording for D-PG9-01, -07, -08, -14, -15 and -16 from docs/mcp-compatibility.md (:143, :145, :147, :383, :767-770). ebcce31e later changed one sentence at docs/mcp-compatibility.md:435 (D-PG7-17, outside this phase). The digest had not been recomputed since the previous pass on tree 328266f5, so this pass also checked the earlier covered-file changes: 6d9a3cdd (D-PG10-25 reversed to fail closed: a `withheld` marker member, `carrySource` in adapter-entry.ts, `UnreadablePluginOptionsError`, a new output-catalog section), b35b86d1 (a comment in orchestrators/marketplace/shared.ts), 6826f6f6, 594ea843, 8c64be00, 3488bf29, 4d6825ba and 9e3dc68b (CHANGELOG.md), and b5692689 (pi-subagents 0.88.1 wording in the two docs). None removes or changes a phase 9 behavior. They move cited lines, and this pass re-pins every citation."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  decision_status: "Every D-PG9 row in PROJECT.md (:2427-2432) is locked as confirmed by the maintainer review 2026-11-16. D-PG9-07 is locked with the openUi default withheld, the divergence confirmed, and the default's return tracked by BACKLOG MCPOPENUI-01. This report no longer calls any D-PG9 decision pending. Where it quotes the earlier pending state, it says so as history."
  overrides_kept:
    - "Override 1, D-PG9-07 as amended: kept; reason re-pinned to the locked row (PROJECT.md:2428) and docs/mcp-compatibility.md:770"
    - "Override 2, D-PG9-14 (caFile trust wording): kept; reason re-pinned to PROJECT.md:2430"
    - "Override 3, D-PG9-14 (choice store keeps no caFile): kept; reason re-pinned (PROJECT.md:2430, adapter-entry.ts:431-433)"
    - "Override 4, D-PG9-03 addition (malformed marker member refuses the file): kept; reason re-pinned (marker.ts:69-77, :90-108)"
  overrides_basis: "Each existing override keeps its accepted_by text exactly as written. Their line numbers are the ones of the previous pass: one row was added above the D-PG9 rows, so D-PG9-07 now sits at PROJECT.md:2428 and D-PG9-14 at :2430. The reasons cite the current lines."
  overrides_added:
    - "Override 5, 09-06 truth 1 (the outcome cell `Pending maintainer review`): basis the locked decision rows D-PG9-01, D-PG9-07 and D-PG9-08 (PROJECT.md:2427, :2428, :2429). The previous pass marked the truth VERIFIED with a note that the rows had since been locked. On the current tree the named outcome no longer holds, so the truth passes by override."
  overrides_removed: []
  info_resolved:
    - "ROADMAP.md:471 now says the planned openUi false default is not written (D-PG9-07, BACKLOG MCPOPENUI-01)."
    - "CHANGELOG.md:39, the Phase 8 line, now says `where Claude Code stops that step` (594ea843)."
prohibitions_flagged: 7
prohibition_review: "NON-AUTHORITATIVE; unverified-prohibition — human review recommended. The seven judgment-tier prohibitions of plans 09-03 to 09-06 were re-read against the current tree, and no violation was found (see the Prohibitions section). Following the Phase 1 re-verification (660e6da6), they are flagged here and listed under Maintainer Review, not as new manual tests."
human_verification: []
---

# Phase 9: Adapter Entries and MCP Features Verification Report

**Phase Goal:** Under pi-mcp-adapter, the entry this project writes for a plugin server keeps a stdio server running for the session, keeps what the user wrote on it, and gives the server only the powers the maintainer decides it may have. The MCP compatibility page says what a plugin server can use beyond tools under each implementation.

**Verified:** 2026-11-17T03:57:54Z
**Status:** passed, with 7 flagged judgment-tier prohibitions. All five roadmap criteria hold as written on the current tree. Of the 33 separate plan truths, 23 hold as written and 10 pass by one of five overrides. Each override rests on a locked decision row or a recorded decision: D-PG9-07 as amended, D-PG9-14, the D-PG9-03 addition, and the locked rows D-PG9-01, -07 and -08. The maintainer review of 2026-11-16 locked every D-PG9 row in PROJECT.md (:2427-2432). D-PG9-07 is locked: the `openUi` default stays withheld, the divergence is confirmed, and BACKLOG MCPOPENUI-01 tracks the default's return.
**Re-verification:** Yes. The previous report (passed, 38/38, four overrides, tree 328266f5) became stale after 421863f6 changed docs/mcp-compatibility.md.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `99e433be`. It did not reuse the earlier verdicts, and summaries were not taken as evidence. Citations are current line numbers. **B/** means `extensions/pi-claude-marketplace/bridges/mcp/`, **D/** means `extensions/pi-claude-marketplace/domain/`, **L/** means `features/mcp-server/lifecycle.feature`, and **M/** means `docs/mcp-compatibility.md`.

What changed since the previous report:

- **421863f6** removed the `pending maintainer review` wording from M/:143 (D-PG9-01), :145, :147 (D-PG9-16), :383 (D-PG9-14) and :767-770 (the four Loading divergences). It changed no other phase passage. **ebcce31e** changed M/:435, a D-PG7-17 sentence outside the phase.
- **6d9a3cdd** reversed D-PG10-25 to fail closed (PROJECT.md:2441). The marker gains a `withheld` member (B/marker.ts:50-57, :99, :106, `withheldOf` :233-236), and a malformed `withheld` member refuses the file like the other members (`MARKER_MEMBERS`, B/marker.ts:141-149). `carrySource` (B/adapter-entry.ts:242-256) reads the user's `disabled` from that member while a load withholds the entry. The load hold-back writes only `disabled` and `withheld`, never a default (B/option-withhold.ts:91-128). The four carried fields, the defaults table, the marker's `defaultFields` and the caFile rule are unchanged. B/adapter-entry.ts lines moved by about 23, and B/marker.ts lines by about 10 to 13.
- **6826f6f6** added the section `Options the install record cannot read` to M/ between :395 and the divergence list, so the list moved from :756-759 to :767-770. The phase passages at M/:139-174 and :379-395 did not move.
- **6d9a3cdd** also added a catalog section near docs/output-catalog.md:4197, so the catalog lines after it moved by 16 (:5304 to :5320, :5318 to :5334, :5370 to :5386). :3085 did not move.
- CHANGELOG.md gained lines above the phase sub-bullets, which moved from :39-42 to :43-46 with the same text.
- No feature file, feature support module or step module that the phase uses changed (`git diff --quiet fb957770 HEAD` exits 0 for each).

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `421863f6` (log `/tmp/pg-final2.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). The unpaired and integration tests passed with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1 and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`, on Node v26.13.1. The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps (seed 115283), so every `@adapter-only` and `@mcp` phase scenario ran. The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 836824), which includes the `@builtin-only` resource guard. Direct coverage merged 376 LCOV records. The log ends with `exit=0`. `git diff --name-only 421863f6 HEAD` outside `.planning/` names only docs/mcp-compatibility.md (ebcce31e), which is not a build input (`paths: &build_inputs` in .github/workflows/ci.yml). So G covers every executable input of HEAD, and the suite was not repeated.

**Independent checks (this pass):** 17 named test groups, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '<name>' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. All passed (see Behavioral Spot-Checks). `query verify.artifacts` gives 4/4, 3/3, 4/4, 3/3, 2/2, 4/4 and `query verify.key-links` gives 3/3, 2/2, 3/3, 2/2, 2/2, 2/2 for plans 09-01 to 09-06, each with exit 0.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 9 must-haves |
| --- | --- | --- |
| D-PG9-07 as amended (7b7bf951, PROJECT.md:2428, locked by the maintainer review 2026-11-16) | No `openUi: false` default is written, because pi-subagents 0.88.1 hashes no `openUi` (D/mcp-server-features.ts:87-90, :111-116). The divergence is confirmed, and the default returns through BACKLOG MCPOPENUI-01 (BACKLOG.md:5480, :5484). | Every plan clause that names the openUi default passes by override 1. Criterion 5 holds through its recorded-decision branch. |
| D-PG9-14 (review fix, PROJECT.md:2430, locked by the maintainer review 2026-11-16) | A carried `caFile` stays only while the entry stays https at the same `URL.origin`. The choice store keeps no `caFile`. A drop shows `MCP server caFile removed.` (B/adapter-entry.ts:401-424, B/adapter-doc.ts:537-546). | Overrides 2 and 3. Criterion 2 holds as written, because its update scenario keeps the origin (L/:638). |
| D-PG9-15 (review fix, PROJECT.md:2431, locked by the maintainer review 2026-11-16) | A user `idleTimeout` other than `null` counts as the user's lifecycle, so no lifecycle default is written beside it (`userHolds`, B/adapter-entry.ts:507-509). | Refines criterion 1 and 09-03 truth 4 (the user's choice wins). Scenarios L/:1005, :1076. |
| D-PG9-16 (review fix, PROJECT.md:2432, locked by the maintainer review 2026-11-16) | Records the background restart of a crashed stdio server as a divergence (M/:147, :768). | Documentation only. No must-have changes. |
| D-PG9-03 addition (09-CONTEXT.md:79-87, accepted with override 4 by the maintainer review 2026-11-16) | A malformed marker member of the plugin's own entry refuses the file (fail closed). | Override 4. The parse still never throws. |
| D-PG9-01, -07, -08 outcome cells (PROJECT.md:2427-2429; 0401bac2, 567585d3) | The plan wrote `Pending maintainer review`. The cells now read `Locked (maintainer review 2026-11-16, confirmed)`. | Override 5 (09-06 truth 1). The 09-06 prohibition held for the run it bound (see Prohibitions). |
| D-PG10-11/-21/-23 (Phase 10) | Per-plugin encoder passed to `stampServers`; a server that names an unset option is left out (L/:763); the caFile origin is read with option values. | Additive. Defaults, carried set, marker and caFile rule are unchanged. |
| D-PG10-25 (Phase 10, reversed to fail closed by the maintainer review 2026-11-16, PROJECT.md:2441) | A `withheld` marker member keeps the user's own `disabled` while a load disables an entry whose record's options do not parse; `carrySource` reads `disabled` from it (B/adapter-entry.ts:242-256). | Additive. No load writes a default (09-03 truth 7 holds). A malformed `withheld` member refuses the file, the same fail-closed rule as override 4. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | The adapter entry written for a stdio plugin server holds `lifecycle: "lazy-keep-alive"`, a remote server's entry stays `lazy`, and a lifecycle the user set on the entry is kept (PG-MCP-06) | ✓ VERIFIED | `transportKind` (D/mcp-server-features.ts:69-80: no type or `stdio` gives stdio; `sse`, `http`, `streamable-http` give remote). The frozen table gives stdio `lifecycle: "lazy-keep-alive"` and remote only `requestTimeoutMs` (:87-90). `adapterEntryDefaults` (:118-123). `defaultFieldsFor` (B/adapter-entry.ts:516-530) fills a default only when neither the translated entry nor the user holds the field. `lifecycle` is carried (`CARRIED_FIELDS`, :63-81). Scenarios: configuration.feature:64 pins the whole file (plain and typed stdio hold the lifecycle; sse and streamable-http hold none). L/:933: a user `lifecycle: "lazy"` survives an update next to a server that keeps the default. L/:470: a change from stdio to remote drops the default. In Gate G. |
| 2 | A user's `protocolVersion: "auto"` on a plugin entry is still there after `/claude:plugin update` and after a reinstall, and so is a user's `tasks`, `exposeResources`, or `caFile` (PG-MCP-09) | ✓ VERIFIED | `CARRIED_FIELDS` ends with the four fields (B/adapter-entry.ts:63-81). `carriedFields` (:258-280) copies each own carried field that is not plugin-set and is not a recorded default. L/:638 pins all four after an update that changes the url path, and L/:683 after a reinstall. L/:721 keeps a `caFile` across a reinstall when the url starts with a variable. The marker records none of the four (test `D-PG9-05: a restage keeps the user's protocolVersion, tasks, exposeResources, and caFile after roots and records none of them`, test/bridges/mcp/adapter-entry.test.ts:1318, passed). D-PG9-14 narrows the caFile carry to the same https origin (L/:878, :816, :858). The criterion does not cover those cases. Folds 09-04 truth 1. |
| 3 | Under each profile, a scenario reads a resource of a plugin server (PG-MCP-08) | ✓ VERIFIED | features/mcp-server/resources.feature:8 (`@adapter-only`): the model calls `mcp` with `mcp__plugin_demo_stub__read_notes`, and the tool result is `mcp returned: stub notes` (:30). Line :33 (`@builtin-only`): `tool_search`, then `read_mcp_resource {"server":"plugin_demo_stub","uri":"stub://notes"}` returns `stub notes` (:58-59). Each ran in its profile in Gate G. These are regression guards, as the roadmap note says. Folds 09-01 truth 6. |
| 4 | `docs/mcp-compatibility.md` states, for each implementation, whether a plugin server can use resources, prompts, elicitation, sampling, roots, and output limits, and says that `@server:uri` mentions do not exist on Pi (PG-MCP-08) | ✓ VERIFIED | Section `## Features beyond tools` at M/:157. The table at :161-168 has columns for Claude Code 2.1.323, pi-mcp-adapter 7.0.1 and Pi built-in 1.5.0, and rows for Resources :163, Prompts :164, Elicitation :165, Sampling :166, Roots :167 and Output limits :168. Each cell names a scenario or a source, and each cell that no scenario backs says unmeasured. M/:172: "`@server:uri` mentions do not exist on Pi, under either implementation." Folds 09-05 truth 5. |
| 5 | Under the adapter, a plugin server's entry holds the fields that withhold `sampling` and the MCP UI extension, or the compatibility page cites the recorded decision that accepts the divergence (PG-SEC-03) | ✓ VERIFIED (the "or" branch) | Sampling: M/:166 and :769 cite D-PG9-08, which PROJECT.md:2429 records with its premise, pi-mcp-adapter 7.0.1 and Claude Code 2.1.323, locked by the maintainer review 2026-11-16. UI: M/:174 and :770 cite D-PG9-07 as amended, which PROJECT.md:2428 records with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1 and its reason, a Pi-companion capability gap. That row is locked (`Locked (maintainer review 2026-11-16, confirmed; the default returns through BACKLOG MCPOPENUI-01)`): the default stays withheld and the divergence is confirmed. Carriers: BACKLOG.md:5476 (MCPSAMPLING-01) and :5480 (MCPOPENUI-01, with the confirmation at :5484), and the draft `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`. No `openUi` default is written (test `D-PG9-07: no transport's defaults hold openUi`, passed). |

### Plan Truths (those that restate a criterion are folded into it)

| Plan | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 09-01 | The adapter listing wait ends once the stub logged its `tools/list` and either no stub runs or Pi's registry holds a tool of the server (D-PG9-01) | ✓ VERIFIED | `listingDone` (features/lib/mcp-implementation.ts:494-511) and `waitForStubListing` (:519-544). Every lifecycle scenario now runs a kept-alive stdio entry and passed in Gate G. |
| 09-01 | A tool of the server is a prefixed name, or, with no prefix, the full name the implementation gives a logged tool, so the 56-character server with tool `deadbeef` is still found | ✓ VERIFIED | `hasStubTool` (mcp-implementation.ts:469-484) branches on `toolNamePrefix`. The logged `tool` member is at features/lib/mcp-stub-server.ts:51, and `listedTools` is at :114-125. features/hook/mcp-tool-names.feature:145-154 passed in Gate G. |
| 09-01 | The hook listing step reaches the same wait; no copy of the rule is left in a step module | ✓ VERIFIED | features/step_definitions/hook/tool-use.steps.ts:39 imports `waitForStubListing` and :336 calls it. listing.steps.ts:151 calls it too. Neither module holds its own rule (key link verified). |
| 09-01 | Every listing feature passes under both profiles, and a temporary resident-stub run shows no listing-wait failure, recorded in the SUMMARY with no file left changed | ✓ VERIFIED | 09-01-SUMMARY.md:71-97: run on top of f0e8979c, 180 scenarios, **0** listing-wait failures, 17 expectation failures later re-pinned by 09-03, and `git diff --quiet` exits 0. Both profiles pass in Gate G. |
| 09-01 | A stub with the resource variable declares `resources` and offers one text resource; without it, the stub answers as before | ✓ VERIFIED | mcp-stub-server.ts:9-12, :41 (`STUB_RESOURCE`), :159 (the capability only when the resource is set), :164-180, :213-216. The default adapter tables are unchanged by 012c23bc (invocation.feature:29-32 shows tools only). |
| 09-02 | `defaultFields` reads as an own plain object of numbers, strings or booleans, and a numbers-only marker still reads (D-PG9-03) | ✓ VERIFIED | `isDefaultValue` and `isDefaultRecord` (B/marker.ts:69-77), `readMarker` (:90-108). 20 `D-PG9-03:` and 9 `D-PG1-13:` marker cases passed. |
| 09-02 | A malformed `defaultFields` reads as absent; reading never throws | PASSED (override) | Override 4 (D-PG9-03 addition). The parse clause holds. A stage or unstage refuses the file (L/:507). |
| 09-02 | `buildMarker` writes a string or boolean default after `pluginSetFields` and before `keptOverride`, and no member for an empty record | ✓ VERIFIED | B/marker.ts:179-196. Tests `D-PG9-03: writes string and boolean defaults after plugin-set fields and before the kept override` (test/bridges/mcp/marker.test.ts:119) and `D-PG1-13: omits default fields when the record is empty` (:137), passed. |
| 09-02 | The 0.23.0 fixture writes an entry with no `requestTimeoutMs`, `lifecycle` or `openUi` and no `defaultFields`; the D-PG1-12 reinstall scenario uses it (D-PG9-04) | ✓ VERIFIED | `writeRelease0230McpAdapterEntry` (features/lib/mcp-server-files.ts:369-392) deletes both defaults and the marker's `defaultFields`. No release writes `openUi`, so the entry holds none. Given at lifecycle.steps.ts:63-70. Used by L/:601 (D-PG1-12 in its title). |
| 09-02 | No product output changes beyond the flipped marker cases | ✓ VERIFIED | bd2643fd and 8424da36 touch only B/marker.ts, B/adapter-entry.ts (the type of `isRecordedDefault`, now :228-235), the marker test, and the 0.23.0 fixture with its feature and steps. |
| 09-03 | A stdio entry holds `lifecycle` and `openUi: false` after `requestTimeoutMs`, and the marker records all three | PASSED (override) | Override 1 (D-PG9-07 as amended, locked). Timeout then lifecycle, both recorded: configuration.feature:64-148. |
| 09-03 | A remote entry holds `openUi: false` and no `lifecycle` (D-PG9-02) | PASSED (override) | Override 1. The no-lifecycle half holds (configuration.feature, `plugin_demo_events_` and `plugin_demo_stream_`). |
| 09-03 | Neither default is plugin-set: the closed table writes no `lifecycle` and no `openUi`, no entry lists them in `pluginSetFields`, built-in registrations do not change | ✓ VERIFIED | Test `ANAME-07 / D-PG9-01: the closed table writes no lifecycle and no openUi, even when the plugin declares them` (test/domain/mcp-server-features.test.ts:145), passed. The built-in translation still reads only `defaultRequestTimeoutMs` (D/mcp-builtin-translation.ts:24, :85; key link verified). |
| 09-03 | A user `lifecycle` or `openUi` wins and is not recorded; a recorded default is recomputed; stdio to remote loses the lifecycle default (D-PG9-03) | ✓ VERIFIED | `isRecordedDefault` (B/adapter-entry.ts:228-235), `userHolds` (:507-509). Tests `D-PG9-03: the user's lifecycle and openUi carry ...` (test/bridges/mcp/adapter-entry.test.ts:879) and `D-PG1-13 / D-PG9-03: recomputes the recorded stdio defaults ...` (:689), passed. Scenarios L/:933 and :470. |
| 09-03 | One adapter `initialize` before the first `tools/call` where the listing ran in the session; no `initialize` declares the MCP Apps UI extension; `sampling`, `roots`, `elicitation` stay declared; tables re-pinned from a recorded run | PASSED (override) | Override 1 covers the UI clause: the rows still declare `io.modelcontextprotocol/ui`. The rest holds: invocation.feature:29-32 has one `initialize`, then `tools/list` and `tools/call`, with `sampling`, `roots` and `elicitation`. The re-pins were run in 6340989e. |
| 09-03 | A 0.23.0 entry gets all three defaults at the next reinstall, and a disable then enable writes them again (D-PG9-04) | PASSED (override) | Override 1 covers "three". The two remaining defaults: L/:601 (reinstall) and L/:564 (disable then enable). |
| 09-03 | No load writes a new default except the AMIG-01 move; no orchestrator file changes | ✓ VERIFIED | The 09-03 commits 581c2f5e, 6340989e, 7b7bf951 and 99680c6d touch no `extensions/.../orchestrators/` file (tests under `test/orchestrators/` only). The defaults live in the stage path (`stampServers`, B/adapter-entry.ts:548-592). The later D-PG10-25 load hold-back writes only `disabled` and the marker's `withheld`, never a default (B/option-withhold.ts:91-128). |
| 09-04 | A caFile the user wrote survives an update that changes the server's url (D-PG9-05) | ✓ VERIFIED | L/:638 changes the url path at the same origin and keeps the `caFile`. Test `D-PG9-14: a caFile survives a url change at the same https origin, whatever the case of the origin` (test/bridges/mcp/adapter-entry.test.ts:1390), passed. D-PG9-14 limits this to the same origin. |
| 09-04 | A plugin cannot set the four fields: the closed table drops them and no entry lists them in `pluginSetFields` | ✓ VERIFIED | Test `AFILE-06: of every ServerEntry key, only the carried keys take their previous values and the plugin's adapter-only values are dropped` (test/bridges/mcp/adapter-entry.test.ts:1181), passed. Its plugin entry sets every ServerEntry key, and the stamped entry holds the previous value of each carried key; a stdio entry holds no `caFile` (D-PG9-14, :1184-1191). `pluginSetFieldsIn` takes only fields the translated entry holds (B/adapter-entry.ts:214-216). |
| 09-04 | The choice store, the uninstall restore and the override-kept notice follow the carried set; `userCarriedFields` returns the four | PASSED (override) | Override 3 (D-PG9-14, locked). |
| 09-04 | No credential-bearing field joins the carried set; an absorbed override's credential fields stay inside the marker | ✓ VERIFIED | `CARRIED_FIELDS` (B/adapter-entry.ts:63-81) holds no `env`, `headers`, `oauth`, `auth` or bearer field. Test `AFILE-06: an absorbed override's credentials stay inside the marker and only carried fields become active` (:1736), passed. |
| 09-04 | A user `lifecycle` and `openUi` survive an update beside a server with the three recorded defaults (D-PG9-03) | PASSED (override) | Override 1 covers "three". L/:933-1003: `plugin_demo_kept_` keeps `lifecycle: "lazy"` and `openUi: true`, and `plugin_demo_plain_` holds the two recorded defaults. |
| 09-05 | The page says this extension writes `lazy-keep-alive` on stdio entries and none on remote ones, what it does under 7.0.1, that a user's lifecycle wins, and when an installed plugin gets the default | ✓ VERIFIED | M/:143 (written for stdio, none for remote, D-PG9-01 and D-PG9-02), :145 (what `lazy-keep-alive` does in 7.0.1), :151 (the user's value wins, D-PG9-03), :153 (at the next restage, not at an update with no new revision, not at a load, D-PG9-04). |
| 09-05 | The page says every plugin entry gets `openUi: false` unless the user set it | PASSED (override) | Override 1. The page states the withheld default instead (M/:174, :385, :770). |
| 09-05 | The page says pi-mcp-adapter 7.0.1 still declares `sampling` to every plugin server and cites D-PG9-08 with its reason | ✓ VERIFIED | M/:166 (`Yes, for every server ... This is a divergence (D-PG9-08)`), and :769 (`Reason: a pi-mcp-adapter capability gap (D-PG9-08)`). |
| 09-05 | The page lists the four carried fields and says why `caFile` can only narrow trust | PASSED (override) | Override 2 (D-PG9-14, locked). |
| 09-05 | `docs/output-catalog.md` describes the resting status of a lazy or lazy-keep-alive server, lists the carried fields as the code holds them, and leaves its example blocks unchanged | ✓ VERIFIED | docs/output-catalog.md:3085 (resting states) and :5334 (the carried fields in `CARRIED_FIELDS` order). c7dfbe44 changes these two prose lines only. |
| 09-06 | PROJECT.md holds rows for D-PG9-01, -07 and -08, each with decision, premise, version, and outcome `Pending maintainer review` | PASSED (override) | Override 5 (the locked rows). PROJECT.md:2427-2429 hold each decision, its premise, pi-mcp-adapter 7.0.1, and Claude Code 2.1.323 in -07 and -08. History: the plan wrote each outcome cell as `Pending maintainer review`. Now each reads `-- Locked (maintainer review 2026-11-16, confirmed)`, and the -07 cell adds `; the default returns through BACKLOG MCPOPENUI-01` (0401bac2, 567585d3). |
| 09-06 | The D-PG9-01 row says it amends ANAME-05 and names the "no" alternative (PG-MCP-06 to Out of Scope) | ✓ VERIFIED | PROJECT.md:2427: the title holds `amends ANAME-05`, and the body says `A "no" moves PG-MCP-06 to Out of Scope`. |
| 09-06 | The D-PG9-08 row licenses the divergence by a pi-mcp-adapter capability gap and names the draft and the BACKLOG entry | ✓ VERIFIED | PROJECT.md:2429 names `.planning/upstream/pi-mcp-adapter-per-server-sampling.md` and MCPSAMPLING-01. |
| 09-06 | The upstream draft exists in the shape of the existing drafts and is not filed | ✓ VERIFIED | `.planning/upstream/pi-mcp-adapter-per-server-sampling.md:1-5` (`Patch: no patch exists; this report is not filed.`, Repository, Package version), the same header as `pi-subagents-long-tool-names.md`. |
| 09-06 | BACKLOG MCPSAMPLING-01 names its trigger and the draft's path | ✓ VERIFIED | BACKLOG.md:5476-5478. |
| 09-06 | CHANGELOG has a sub-bullet under the parity-gaps entry of `[Unreleased]` that says what adapter users see and to run `/claude:plugin reinstall` once; no version file changes | ✓ VERIFIED | CHANGELOG.md:43 under `## [Unreleased]` (:3). b5644587 touches only CHANGELOG.md. Lines :44-46 were added later by the review fixes (D-PG9-16, -15, -14). |

**Score:** 38/38 (28 VERIFIED, 10 PASSED (override); 0 present, behavior-unverified)

### Prohibitions (judgment tier, flagged)

All seven are `verification: judgment`, none is test-tier. These verdicts are non-authoritative LLM judgments: **unverified-prohibition — human review recommended**.

| Plan | Prohibition | Non-authoritative verdict and evidence |
| --- | --- | --- |
| 09-03 | MUST NOT replace a user `lifecycle` or `openUi` with a default at any restage (PG-MCP-06) | Holds. `userHolds` and `defaultFieldsFor` (B/adapter-entry.ts:507-530). L/:933. Unit cases `D-PG9-03:` and `D-PG9-15:` passed. |
| 09-03 | MUST NOT write pi-mcp-adapter's global `settings.sampling` or any member outside the plugin's own entries (PG-SEC-03) | Holds. No `.ts` file under `extensions/pi-claude-marketplace/` names `sampling`. The one top-level member the extension writes, `_piClaudeMarketplace.serverChoices`, predates the phase (D-08-02). The D-PG10-25 `withheld` member sits inside the plugin's own entry marker. |
| 09-04 | MUST NOT add a credential-bearing field to the carried set (PG-MCP-09) | Holds. `CARRIED_FIELDS` (B/adapter-entry.ts:63-81). The absorbed-override credential test passed. |
| 09-05 | MUST NOT say or imply that this extension withholds `sampling` under 7.0.1 (PG-SEC-03) | Holds. M/:166 says `Yes, for every server`, and :769 says the extension does not write the global setting. |
| 09-05 | MUST NOT describe a cell as measured unless a scenario or recorded run of this repository backs it (PG-MCP-08) | Holds. Each `Measured:` cell in M/:163-168 names resources.feature or invocation.feature. Prompts and output limits say unmeasured. |
| 09-06 | MUST NOT record D-PG9-01, -07 or -08 as locked or as a maintainer decision (PG-SEC-03) | Holds for the run it bound. The phase commits recorded the three rows as pending maintainer review (history). The maintainer review of 2026-11-16 then locked them (0401bac2 for -01 and -08, 567585d3 for -07; PROJECT.md:2427-2429). That is the maintainer decision the prohibition left open, not a phase write. |
| 09-06 | MUST NOT tell the reader that installed plugins change by themselves (PG-MCP-06) | Holds. CHANGELOG.md:43: `Run /claude:plugin reinstall once to apply this to an installed plugin.` |

## Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| D/mcp-server-features.ts | ✓ VERIFIED | Defaults table :87-90, `adapterEntryDefaults` :118-123. Imported by B/adapter-entry.ts and B/marker.ts. |
| B/adapter-entry.ts | ✓ VERIFIED | Carried set :63-81, `carrySource` :242-256, `carriedFields` :258-280, `appliedCarriedFields` :401-424, `userCarriedFields` :431-433, `restoredOverride` :468, `defaultFieldsFor` :516-530, `stampServers` :548-592. |
| B/marker.ts | ✓ VERIFIED | Scalar defaults :69-77, `readMarker` :90-108, `malformedMarkerMember` :159, `buildMarker` :179-196, `defaultFieldsOf` :227-231. |
| B/adapter-doc.ts | ✓ VERIFIED | `assertOwnedMarkersReadable` :244-260 (called at stage.ts:467 and unstage.ts:107), `leavingChoice` :537-546. |
| features/lib/mcp-implementation.ts, mcp-stub-server.ts, mcp-server-files.ts | ✓ VERIFIED | Listing rule, logged tool, opt-in resource, 0.23.0 fixture (see the plan rows). Unchanged since the previous pass. |
| features/mcp-server/resources.feature, configuration.feature, L/ | ✓ VERIFIED | :8 and :33; :64; the phase scenarios at L/:470, :507, :564, :601, :638, :683, :721, :816, :858, :878, :933, :1005, :1076. Unchanged since the previous pass. |
| M/ and docs/output-catalog.md | ✓ VERIFIED | M/:139-174, :379-395, :767-770; catalog :3085, :5320, :5334, :5386. |
| PROJECT.md rows, BACKLOG entries, upstream draft, CHANGELOG | ✓ VERIFIED | PROJECT.md:2427-2432, all locked; BACKLOG.md:5476, :5480; the draft; CHANGELOG.md:43-46. |

## Key Link Verification

`query verify.key-links`: 3/3, 2/2, 3/3, 2/2, 2/2, 2/2 (09-01 to 09-06). Manual trace: `stampServers` (B/adapter-entry.ts:548) -> `appliedCarriedFields` (:565) -> `defaultFieldsFor` (:575) -> `adapterEntryDefaults` (:526) -> `buildMarker(..., { pluginSetFields, defaultFields, keptOverride })` (:583). The previous record comes back through `defaultFieldsOf` in `carriedFields` (:265). The update row maps `McpConfigFileError` to `unreadable` (orchestrators/plugin/update-flow.ts:979). L/:507 pins the `unreadable` row.

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| --- | --- | --- | --- | --- |
| Written `mcp-adapter.json` entries | defaults, carried fields, marker | the plugin's `.mcp.json` translated, the previous entry, the defaults table | Yes. configuration.feature:64 and L/ pin the exact file text | ✓ FLOWING |
| `MCP server caFile removed.` rows | `caFileRemoved` | `appliedCarriedFields` and the unstage removal | Yes. L/:858 and :878 assert the rows | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each exited 0 and reported `fail 0`.

| ID | Named test (pattern) | File | Result |
| --- | --- | --- | --- |
| M1 | `^adapterEntryDefaults$` | test/domain/mcp-server-features.test.ts | PASS (10/10) |
| M2 | `^D-PG9-07: no transport` | same | PASS (1/1) |
| M3 | `^ANAME-07 / D-PG9-01: the closed table writes no lifecycle and no openUi` | same | PASS (1/1) |
| M4 | `^defaultRequestTimeoutMs$` | same | PASS (6/6) |
| K1 | `^D-PG9-03: ` | test/bridges/mcp/marker.test.ts | PASS (20/20) |
| K2 | `^D-PG1-13: ` | same | PASS (9/9) |
| K3 | `^malformedMarkerMember$` | same | PASS (11/11) |
| A1 | `^D-PG9-05: ` | test/bridges/mcp/adapter-entry.test.ts | PASS (4/4) |
| A2 | `^D-PG9-03: ` | same | PASS (4/4) |
| A3 | `^D-PG9-02 / D-PG9-07: ` | same | PASS (1/1) |
| A4 | `^D-PG1-13 / D-PG9-03: ` | same | PASS (1/1) |
| A5 | `^D-PG9-14: ` | same | PASS (27/27) |
| A6 | `^D-PG9-15: ` | same | PASS (6/6) |
| A7 | `^AFILE-06: an absorbed override's credentials stay inside the marker` | same | PASS (1/1) |
| A8 | `^D-08-02: ` | same | PASS (3/3) |
| A9 | `^AFILE-06: of every ServerEntry key` | same | PASS (1/1) |
| A10 | `^D-PG10-25: ` (the later `withheld` carry) | same | PASS (2/2) |
| G | `npm run check` at `421863f6` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

## Probe Execution

Not applicable. No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` exists. The resident-stub run of 09-01 was a recorded, uncommitted measurement, and its record is the evidence.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-MCP-06 | 01, 02, 03, 04, 05, 06 | ✓ SATISFIED | Criterion 1. REQUIREMENTS.md:59 `[x]`, trace :200 Complete |
| PG-MCP-09 | 04, 05, 06 | ✓ SATISFIED (caFile narrowed by D-PG9-14, locked) | Criterion 2. REQUIREMENTS.md:61 `[x]`, trace :202 Complete |
| PG-MCP-08 | 01, 05 | ✓ SATISFIED | Criteria 3, 4. REQUIREMENTS.md:60 `[x]`, trace :201 Complete |
| PG-SEC-03 | 02, 03, 04, 05, 06 | ✓ SATISFIED through the recorded divergences D-PG9-07 (amended) and D-PG9-08, both locked by the maintainer review 2026-11-16 | Criterion 5. REQUIREMENTS.md:82 `[x]`, trace :214 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 9, and each appears in plan frontmatter.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| D/mcp-server-features.ts, B/adapter-entry.ts, B/marker.ts, B/adapter-doc.ts, mcp-implementation.ts, mcp-stub-server.ts, resources/lifecycle/configuration features | TBD / FIXME / XXX / TODO / HACK | None | No match |
| features/mcp-server/*.feature | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- `test/integration/pi-subagents-child-identity.test.ts`, which M/:770, PROJECT.md:2428 and BACKLOG.md:5480 cite for the openUi measurement, never names `openUi`. The citation records a run in which the test failed with the default written, not an assertion in the file. That is accurate, but no committed test pins it.
- Outside this report: 09-SECURITY.md still says `pending maintainer review` in T-09-15 (:61), T-09-20 (:66, which also cites PROJECT.md:2426-2428 and the old pending outcomes) and open item 2 (:84). The rows it names are now locked. That register is not a covered file of this report, so this pass did not change it.
- Resolved since the previous pass: ROADMAP.md:471 now says the planned `openUi: false` default is not written (D-PG9-07, BACKLOG MCPOPENUI-01). CHANGELOG.md:39, the Phase 8 line, now ends `where Claude Code stops that step` (594ea843).
- The previous pass cited lines that later commits moved: B/adapter-entry.ts (+23), B/marker.ts (+10 to +13), M/:756-759 (now :767-770), catalog :5304/:5318/:5370 (now :5320/:5334/:5386), CHANGELOG.md:39-42 (now :43-46), BACKLOG.md:5470/:5474 (now :5476/:5480), and PROJECT.md:2426-2431 (now :2427-2432). The content is the same, and this report cites the new lines.

## Human Verification Required

None. The judgment-tier prohibitions are flagged above and listed under Maintainer Review, following the Phase 1 re-verification (660e6da6).

## Maintainer Review

The maintainer review of 2026-11-16 decided items 1 to 7. Each decision is locked as confirmed, so none of them waits for the maintainer any more. Item 8 stays a recommendation. None is a gap:

1. **D-PG9-01 / D-PG9-04** (PROJECT.md:2427, locked): `lazy-keep-alive` for stdio plugin servers. Existing installs get it only at their next restage.
2. **D-PG9-07 as amended** (PROJECT.md:2428, locked with `the default returns through BACKLOG MCPOPENUI-01`): the `openUi` default stays withheld, the divergence is confirmed, and BACKLOG MCPOPENUI-01 (BACKLOG.md:5480, :5484) tracks the default's return once pi-subagents hashes `openUi`. Override 1 rests on it. T-09-09 stays an accepted risk (09-SECURITY.md:55).
3. **D-PG9-08** (PROJECT.md:2429, locked): the sampling divergence. Filing the drafted upstream request stays the maintainer's call (BACKLOG MCPSAMPLING-01).
4. **D-PG9-14** (PROJECT.md:2430, locked): the same-origin `caFile` rule, no `caFile` in the choice store, the `entry-removed` notice, and the stub write-back residual. Overrides 2 and 3 rest on it.
5. **D-PG9-15** (PROJECT.md:2431, locked): any user `idleTimeout` other than `null` replaces the lifecycle default.
6. **D-PG9-16** (PROJECT.md:2432, locked): the background restart of a crashed stdio server, a divergence that no scenario has measured.
7. **D-PG9-03 addition** (09-CONTEXT.md:79-87): a malformed marker member refuses the file (fail closed), and an update reports it as `{unreadable}`. Override 4 rests on it, and the maintainer review accepted that override.
8. **Seven flagged judgment-tier prohibitions** (see Prohibitions): the verifier's non-authoritative verdict is that all seven hold. Human review recommended.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria and all 33 counted plan truths of Phase 9 hold, 10 of the truths by override, and every citation points at a current line.

The change that made the report stale, 421863f6, removed `pending maintainer review` from the compatibility page and changed no behavior. The earlier covered-file changes since the previous pass were the D-PG10-25 reversal (a `withheld` marker member and a load hold-back that writes only `disabled`), CHANGELOG and catalog additions around the phase text, and a comment. None removes or changes a phase 9 behavior.

This pass made the report match the locked decision rows. Every D-PG9 row is locked as of 2026-11-16, and D-PG9-07 is locked with the `openUi` default withheld and its return tracked by BACKLOG MCPOPENUI-01. One plan truth (09-06 truth 1) names the `Pending maintainer review` outcome that the review replaced, so it now passes by a new override 5. That override rests on the locked rows D-PG9-01, -07 and -08 (PROJECT.md:2427-2429). The score stays 38/38, now 28 VERIFIED and 10 PASSED (override).

---

_Verified: 2026-11-17T03:57:54Z_
_Verifier: Claude (gsd-verifier)_
