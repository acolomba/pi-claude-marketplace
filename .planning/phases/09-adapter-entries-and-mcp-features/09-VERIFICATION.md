---
phase: 09-adapter-entries-and-mcp-features
verified: 2026-11-15T02:10:00Z
status: passed
score: 9/9 must-haves verified (5/5 roadmap success criteria; 4 superseded plan truths carried by proposed overrides)
covered_files: [".planning/phases/09-adapter-entries-and-mcp-features/09-01-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-01-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-02-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-02-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-03-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-03-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-04-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-04-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-05-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-05-SUMMARY.md",".planning/phases/09-adapter-entries-and-mcp-features/09-06-PLAN.md",".planning/phases/09-adapter-entries-and-mcp-features/09-06-SUMMARY.md","CHANGELOG.md","docs/json-output.md","docs/mcp-compatibility.md","docs/output-catalog.md","extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/marker.ts","extensions/pi-claude-marketplace/bridges/mcp/stage.ts","extensions/pi-claude-marketplace/bridges/mcp/types.ts","extensions/pi-claude-marketplace/bridges/mcp/unstage.ts","extensions/pi-claude-marketplace/domain/mcp-server-features.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts","extensions/pi-claude-marketplace/shared/errors-bridges.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-json.ts","extensions/pi-claude-marketplace/shared/notification-mcp.ts","extensions/pi-claude-marketplace/shared/notification-resolve.ts","extensions/pi-claude-marketplace/shared/notification-types.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","features/lib/hook-mcp-tool-server.ts","features/lib/mcp-implementation.ts","features/lib/mcp-server-files.ts","features/lib/mcp-stub-server.ts","features/mcp-server/companion-missing.feature","features/mcp-server/configuration.feature","features/mcp-server/invocation.feature","features/mcp-server/legacy-move.feature","features/mcp-server/lifecycle.feature","features/mcp-server/project-scope.feature","features/mcp-server/resources.feature","features/plugin/subagent-child.feature","features/step_definitions/hook/tool-use.steps.ts","features/step_definitions/mcp-server/lifecycle.steps.ts","features/step_definitions/mcp-server/listing.steps.ts","features/step_definitions/mcp-server/resources.steps.ts","features/step_definitions/mcp-server/verdict-settings.steps.ts","schema/claude-plugin.schema.json","test/architecture/integration-materialization-gate.test.ts","test/architecture/mcp-config-notices.test.ts","test/bridges/mcp/adapter-doc.test.ts","test/bridges/mcp/adapter-entry.test.ts","test/bridges/mcp/marker.test.ts","test/bridges/mcp/stage.test.ts","test/bridges/mcp/unstage.test.ts","test/domain/mcp-server-features.test.ts","test/integration/mcp-home-path-partial.test.ts","test/integration/mcp-legacy-sweep.test.ts","test/integration/mcp-override-lifecycle.test.ts","test/integration/mcp-variable-expansion.test.ts","test/orchestrators/marketplace/shared.test.ts","test/orchestrators/plugin/install-flow-ledger.test.ts","test/orchestrators/plugin/reinstall-flow.test.ts","test/orchestrators/plugin/update-flow.test.ts","test/orchestrators/plugin/update-swap.test.ts","test/orchestrators/reconcile/mcp-migration.test.ts","test/shared/errors-bridges.test.ts","test/shared/notification-json.test.ts","test/shared/notification-mcp.test.ts","test/shared/notification-resolve.test.ts"]
covered_digest: "v4:sha256:546a74ef3c653129f7a4406c22804b4fec2318fb6616f0f54bcde3c159fd5b61"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "After an install, the mcp-adapter.json entry of a stdio plugin server holds lifecycle lazy-keep-alive and openUi false, and the entry of a remote plugin server holds openUi false and no lifecycle; the page says that every plugin server entry gets openUi false unless the user set openUi (09-03 truths 1-2, 09-05 truth 2)"
    reason: "D-PG9-07 amended during execution: pi-subagents 0.88.1 computeMcpServerHash leaves out openUi, so an openUi false default makes the adapter tool cache read as stale and an agent with a plugin MCP grant cannot launch (test/integration/pi-subagents-child-identity.test.ts). The lifecycle half ships; the UI half is a recorded divergence (PROJECT.md D-PG9-07 row, docs/mcp-compatibility.md:174 and :661, BACKLOG MCPOPENUI-01). Roadmap SC5 takes the 'or the page cites the recorded decision' branch, so only the plan truths need this override."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-15T02:10:00Z"
  - must_have: "The page lists the carried fields with protocolVersion, tasks, exposeResources, and caFile, and says why caFile can only narrow trust (09-05 truth 4)"
    reason: "D-PG9-14 (proposed in 09-REVIEW-FIX.md) withdraws 'can only narrow trust': at its origin the entry trusts exactly the bundle (pi-mcp-adapter 7.0.1 http-ca.ts). docs/mcp-compatibility.md:383 now states that and lists all four carried fields at :381."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-15T02:10:00Z"
  - must_have: "The disable and enable choice store, the uninstall restore, and the override-kept notice follow the carried set with no other change: userCarriedFields returns the four (09-04 truth 4)"
    reason: "D-PG9-14 (proposed): the D-08-02 choice store keeps no caFile because it records no url (adapter-doc.ts leavingChoice), and a disable, uninstall, or dropped server reports ca-file-removed with reason entry-removed (lifecycle.feature:803). The other three fields follow the carried set as planned."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-15T02:10:00Z"
  - must_have: "A defaultFields that holds a null, an object, or an array value reads as absent, so each value of the entry reads as the user's (09-02 truth 2)"
    reason: "Review fix WR2-03/IN3-04 (D-PG9-03 addition, proposed): a malformed marker member of the staging plugin's entry now refuses mcp-adapter.json with McpConfigFileError marker-not-valid and leaves the bytes unchanged (fail closed on corrupt data, the project rule). The marker parse itself still never throws. Scenario lifecycle.feature:505."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-15T02:10:00Z"
gaps:
  - truth: "Every decision ID that the shipped docs, the output catalog, and the source cite as licensing a behavior or a divergence is recorded in the decision register (09-CONTEXT.md and the PROJECT.md Key Decisions table), and recorded decision text does not contradict the shipped behavior"
    status: failed
    reason: "D-PG9-14, D-PG9-15, and D-PG9-16 exist only as proposed parent-line texts in 09-REVIEW-FIX.md ('for the orchestrator; not applied'). Neither 09-CONTEXT.md nor PROJECT.md records them (PROJECT.md holds only D-PG9-01/07/08 at :2396-2398), yet docs/mcp-compatibility.md:145, :147, :381, :385, :659, docs/output-catalog.md:5313 (a section heading), and bridges/mcp/{adapter-entry,adapter-doc,stage,unstage,types}.ts cite them. D-PG9-16 is cited as the license of an upstream divergence (stdio background restart), and AGENTS.md admits a divergence only under a recorded project decision with an ID. 09-CONTEXT.md D-PG9-02 still says a per-entry lifecycle 'overrides nothing the user set elsewhere', which the review found false and the shipped docs contradict (docs/mcp-compatibility.md:145); D-PG9-05 still says caFile 'can only narrow trust'; the D-PG9-03 marker-not-valid addition is unrecorded."
    artifacts:
      - path: ".planning/phases/09-adapter-entries-and-mcp-features/09-CONTEXT.md"
        issue: "No D-PG9-14/15/16 bullets; D-PG9-02 last sentence and D-PG9-05 trust wording stale; D-PG9-03 marker refusal addition and the pending-review list additions missing"
      - path: ".planning/PROJECT.md"
        issue: "Key Decisions lacks D-PG9-14, D-PG9-15, D-PG9-16 rows; D-PG9-01 row lacks 'Amended by D-PG9-15; its background restart is recorded by D-PG9-16.'"
    missing:
      - "Apply the iteration-3 parent-line texts of 09-REVIEW-FIX.md (lines 361-390, plus the iteration-1 D-PG9-16 bullet at line 136 and the D-PG9-02 replacement at line 131) to 09-CONTEXT.md"
      - "Append the D-PG9-14 and D-PG9-15 rows (iteration-3 texts, 09-REVIEW-FIX.md:386, :390) and the D-PG9-16 row (iteration-1 text, :149) to PROJECT.md Key Decisions, and amend the D-PG9-01 row's first cell (:151)"
advisory:
  - finding: "09-SECURITY.md was audited at d987142a, before the three review-fix rounds; several evidence cells are stale"
    category: security
    reason: "No threat changes from closed to open, but T-09-05 evidence ('otherwise the whole member is dropped') is now a fail-closed refusal (marker-not-valid); T-09-15/AR-09-05 ('after a plugin url change, the new origin must chain to the user's bundle') is narrowed to same-origin changes by D-PG9-14; Advisories 1, 2 and 4 are resolved (0ed26d1c, 80ee569c). A short addendum citing D-PG9-14 and the entry-removed notice would bring it current."
    evidence_status: "source read at bea13012; no deterministic failure"
---

# Phase 9: Adapter Entries and MCP Features Verification Report

**Phase Goal:** Under pi-mcp-adapter, the entry this project writes for a plugin server keeps a stdio server running for the session, keeps what the user wrote on it, and gives the server only the powers the maintainer decides it may have. The MCP compatibility page says what a plugin server can use beyond tools under each implementation.
**Verified:** 2026-11-15T02:10:00Z, at HEAD `bea13012` in `/home/acolomba/src/pi-claude-marketplace-gaps-mcp` (branch `features/gaps-mcp`)
**Status:** passed (the records gap was closed by 32557c7c; four orchestrator overrides and the decisions under maintainer review remain, as in Phases 3 to 7)
**Re-verification:** No, initial verification

## Gate evidence

- `git diff --stat bea13012..HEAD` is empty (HEAD is `bea13012`), and the working tree is clean.
- Phase gate, not rerun: `/tmp/pg9-phasegate.log` names `bea13012` on line 1. `npm run check` passed every static step, 1938 adapter scenarios and 185 builtin scenarios passed, and direct coverage merged 362 records, ending in `exit=0`.
- Owner tests rerun here: `node --test test/bridges/mcp/adapter-entry.test.ts test/bridges/mcp/marker.test.ts test/domain/mcp-server-features.test.ts test/bridges/mcp/adapter-doc.test.ts` exited 0. These tests use hermetic homes, and nothing read or wrote the real `~/.pi/agent`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 (PG-MCP-06): the adapter entry of a stdio plugin server holds `lifecycle: "lazy-keep-alive"`, a remote server's entry stays `lazy`, and a lifecycle the user set is kept | ✓ VERIFIED | `domain/mcp-server-features.ts:68-80` (`transportKind`: no type or `stdio` gives stdio; `sse`/`http`/`streamable-http` give remote), `:86-89` (frozen `ADAPTER_ENTRY_DEFAULTS`: stdio gets `lifecycle: "lazy-keep-alive"`, remote gets only `requestTimeoutMs`), `:116-121`. `bridges/mcp/adapter-entry.ts:496-509` `defaultFieldsFor` fills a default only when neither the translated entry nor the carried fields hold the field. `lifecycle` is in `CARRIED_FIELDS` (`:67`). Scenarios: `features/mcp-server/configuration.feature:64` pins the full file (plain and typed stdio hold `lifecycle`; sse and streamable-http hold none). `lifecycle.feature:878` (user `lifecycle: "lazy"` survives an update next to a server that keeps the default), `:468` (stdio to remote drops the default), `:599` (an entry written by release 0.23.0 gets the default at reinstall, D-PG9-04), `:562` (disable then enable). D-PG9-15 refinements: `:950`, `:1021`. |
| 2 | SC2 (PG-MCP-09): a user's `protocolVersion: "auto"`, `tasks`, `exposeResources`, and `caFile` are still there after `update` and after `reinstall` | ✓ VERIFIED | `adapter-entry.ts:62-80` adds the four fields to `CARRIED_FIELDS`. `carriedFields` (`:239-260`) copies own properties that are neither plugin-set nor recorded defaults. `lifecycle.feature:636` pins all four after an update that changes the url path, and `:681` pins all four after a reinstall. `:719` keeps a `caFile` across a reinstall when the url starts with `${PI_CM_BASE}`. The marker records none of the four. Narrowing (D-PG9-14, proposed): `caFile` is dropped, with the `ca-file-removed` notice, when the server stops being https or moves to another `URL.origin` (`adapter-entry.ts:343-375`, `lifecycle.feature:823`), and at a disable, an uninstall, or a dropped server (`:761`, `:803`). The SC does not cover any of these cases, so the SC as written holds. The maintainer should still look at the narrowing (see Human Verification). |
| 3 | SC3 (PG-MCP-08): under each profile, a scenario reads a resource of a plugin server | ✓ VERIFIED | `features/mcp-server/resources.feature:8` (`@adapter-only`: the scripted model calls `mcp` with `mcp__plugin_demo_stub__read_notes`, and the tool result is `mcp returned: stub notes`). `:33` (`@builtin-only`: `tool_search` first, then `read_mcp_resource {"server":"plugin_demo_stub","uri":"stub://notes"}` returns `stub notes`). Both passed in the phase gate. As the ROADMAP note says, they are regression guards and not red-green proofs (09-VALIDATION.md "Regression guards"). |
| 4 | SC4 (PG-MCP-08): `docs/mcp-compatibility.md` states, for each implementation, whether a plugin server can use resources, prompts, elicitation, sampling, roots, and output limits, and that `@server:uri` mentions do not exist on Pi | ✓ VERIFIED | `docs/mcp-compatibility.md:157-170`: the "Features beyond tools" table has six rows (Resources :163, Prompts, Elicitation, Sampling :166, Roots, Output limits :168) and columns for Claude Code 2.1.323, pi-mcp-adapter 7.0.1, and Pi built-in 1.5.0. Each cell names a scenario or a source, and each cell with no scenario says unmeasured. `:172`: "`@server:uri` mentions do not exist on Pi, under either implementation." |
| 5 | SC5 (PG-SEC-03): the adapter entry holds the fields that withhold `sampling` and the MCP UI extension, or the compatibility page cites the recorded decision that accepts the divergence | ✓ VERIFIED (via the "or" branch) | Sampling: `docs/mcp-compatibility.md:166` and `:660` cite D-PG9-08, which `PROJECT.md:2398` records with its premise and pi-mcp-adapter 7.0.1. UI: `:174` and `:661` cite D-PG9-07 as amended, which `PROJECT.md:2397` records with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, and the reason (a Pi-companion capability gap). The trigger entries `BACKLOG.md:5329` MCPSAMPLING-01 and `:5333` MCPOPENUI-01 exist, and so does the upstream draft `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`. No `openUi` default is written (`mcp-server-features.ts:86-89`, guard `test/domain/mcp-server-features.test.ts:111`). Both answers rest on decisions pending maintainer review. |
| 6 | 09-03 T1/T2 and 09-05 T2: an `openUi: false` default on every plugin entry | PASSED (override) | Withheld under the D-PG9-07 amendment. See override 1. |
| 7 | 09-05 T4: the page says why `caFile` "can only narrow trust" | PASSED (override) | Withdrawn by D-PG9-14 (proposed). The page now says that the entry "trusts exactly the certificates in your bundle" (`docs/mcp-compatibility.md:383`). See override 2. |
| 8 | 09-04 T4: the choice store keeps all four new carried fields | PASSED (override) | The choice store keeps no `caFile` (D-PG9-14, proposed), and a removal reports `entry-removed` (`lifecycle.feature:803`). See override 3. |
| 9 | 09-02 T2: a malformed `defaultFields` reads as absent | PASSED (override) | A malformed member is now refused with `marker-not-valid` and the file stays unchanged (`lifecycle.feature:505`). The parse itself still never throws. See override 4. |

**Score:** 9/9 truths verified (5 directly; 4 by proposed override; 0 present but behavior-unverified)

The other plan truths are covered by the SC evidence above, or by the phase gate run that executes every scenario, unit test, and direct-coverage pair at `bea13012`. These include the 09-01 listing wait, the stub resource, the marker widening, the 0.23.0 fixture, the pinned stub-message tables, the plugin's inability to set the new fields, and the 09-06 records.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/domain/mcp-server-features.ts` | stdio/remote defaults table | ✓ VERIFIED | `:83-121`, frozen, imported by `adapter-entry.ts` and `marker.ts` |
| `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts` | carried set, defaults, caFile rule | ✓ VERIFIED | `:62-80`, `:239-260`, `:343-400`, `:487-509`; called by `stampServers` (`:551`) |
| `extensions/pi-claude-marketplace/bridges/mcp/marker.ts` | scalar `defaultFields`, malformed-member detection | ✓ VERIFIED | Owner test passes; wired through `adapter-doc.ts` `assertOwnedMarkersReadable` into stage and unstage |
| `features/mcp-server/resources.feature` | one resource read per profile | ✓ VERIFIED | `:8`, `:33` |
| `features/mcp-server/lifecycle.feature`, `configuration.feature` | entry scenarios | ✓ VERIFIED | 13 phase scenarios listed above |
| `docs/mcp-compatibility.md` | Features beyond tools, lifecycle, overrides, divergences | ✓ VERIFIED | `:139-174`, `:379-385`, `:657-661` |
| `.planning/PROJECT.md` Key Decisions | D-PG9 rows | ⚠️ PARTIAL | D-PG9-01/07/08 present (`:2396-2398`); D-PG9-14/15/16 absent (gap) |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `adapterEntryDefaults` | `defaultFieldsFor` | import, filtered by `userHolds` | WIRED (`adapter-entry.ts:505`) |
| `appliedCarriedFields` | `stampServers` | call at `:551`; `caFileRemoved` goes to stage notices | WIRED (`lifecycle.feature:823` pins the notice row) |
| `malformedMarkerMember` | stage/unstage refusal | `assertOwnedMarkersReadable` → `McpConfigFileError("marker-not-valid")` | WIRED (`lifecycle.feature:505`) |
| `McpConfigFileError` | update row reason | `untypedUpdateFailReason` maps it to `unreadable` (WR3-04) | WIRED (scenario row reads `unreadable`) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Defaults, carried set, caFile rule, and marker parse | `node --test` on the four owner test files | exit 0 | ✓ PASS |
| Full combined tree | `npm run check` (phase gate, not rerun) | exit 0, 1938/185 scenarios, 362 records | ✓ PASS (recorded) |

### Probe Execution

None declared. No `scripts/*/tests/probe-*.sh` exists, and no PLAN names a probe.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-MCP-06 | 01, 02, 03, 04, 05, 06 | ✓ SATISFIED | Truth 1 |
| PG-MCP-09 | 04, 05, 06 | ✓ SATISFIED (narrowed for `caFile` by proposed D-PG9-14) | Truth 2 |
| PG-MCP-08 | 01, 05 | ✓ SATISFIED | Truths 3, 4 |
| PG-SEC-03 | 02, 03, 04, 05, 06 | ✓ SATISFIED via recorded divergences (D-PG9-07 amended, D-PG9-08), pending maintainer review | Truth 5 |

No orphaned requirements: REQUIREMENTS.md maps exactly these four IDs to Phase 9 (`:200-202`, `:214`). Their checkboxes still read Pending, which phase completion normally updates.

### Classified known items

| Item | Classification |
| --- | --- |
| UI half of PG-SEC-03 withheld (D-PG9-07 amendment, MCPOPENUI-01) | SC5 holds through its "or" branch, because D-PG9-07 is recorded in PROJECT.md. The plan truths that asked for `openUi: false` are carried by override 1. T-09-09 stays an accepted residual, and it reopens as a high blocker if the maintainer rejects the amendment. |
| Sampling (D-PG9-08, MCPSAMPLING-01) | Recorded divergence, licensed by a pi-mcp-adapter capability gap. SC5 holds, and no override is needed. |
| D-PG9-16 background restart | Documented as an unmeasured divergence (`docs/mcp-compatibility.md:147`, `:659`). It is licensed only by an ID that the register does not yet hold, which is part of the gap. |
| D-PG9-14 caFile dropped across an origin or transport change, and at uninstall or disable | Narrows PG-MCP-09 for `caFile` outside the SC's cases. Each drop shows a user-visible `ca-file-removed` notice with a closed reason. Overrides 2 and 3 cover the plan truths. The ID is unrecorded (gap). |
| 09-SECURITY.md audited at d987142a | No disposition flips. The `ca-file-removed` lines (`shared/notification-mcp.ts:108-114`) hold no path, no url, and no variable value. Env-based url resolution (`adapter-entry.ts:262-305`) reuses the existing substitution env (`substitute.ts:66-68`) and feeds only an origin comparison, never output. The `marker-not-valid` refusal fails closed and names the entry key escaped through `printable`. T-09-05 is stronger now, and T-09-15/AR-09-05 are narrower. One residual: the stage resolves the url with the substitution env, while the adapter resolves it with its own process env at connect time, so the two can disagree. Recorded as an advisory: the register needs an addendum. |

### Anti-Patterns Found

No `TODO`, `FIXME`, `XXX`, `HACK`, or `TBD` lines were added in `deaa35c4..HEAD` across the 60 non-planning files. No stubs were found.

### Human Verification Required (maintainer review, not runtime UAT)

1. **D-PG9-01 / D-PG9-04:** `lazy-keep-alive` for stdio plugin servers, with existing installs getting it only at the next restage. Alternatives: `keep-alive`, or move PG-MCP-06 to Out of Scope.
2. **D-PG9-07 amendment:** no `openUi` default until pi-subagents hashes `openUi` (MCPOPENUI-01). Rejecting it reopens T-09-09 as a high blocker.
3. **D-PG9-08:** the sampling divergence, plus filing the drafted upstream request.
4. **D-PG9-14:** the `caFile` same-origin rule, no `caFile` in the choice store, the `entry-removed` notice, and the residual that a stub holding only `{caFile}` is not written back.
5. **D-PG9-15:** any user `idleTimeout` except `null` replaces the lifecycle default.
6. **D-PG9-16:** the background restart of a crashed stdio server (unmeasured).
7. **D-PG9-03 addition:** a malformed marker member refuses the file (fail closed), reported as `{unreadable}`.

### Gaps Summary

All five roadmap success criteria hold at `bea13012`, and the phase gate is green. The one gap is in the records. The review-fix rounds introduced D-PG9-14, D-PG9-15, and D-PG9-16 and changed D-PG9-02, D-PG9-03, and D-PG9-05. The shipped docs, the output catalog (including the heading `### MCP server caFile removed (D-PG9-14)`), and the source comments already cite those IDs. Their texts still exist only as parent-line proposals in `09-REVIEW-FIX.md`. One cited ID, D-PG9-16, is the stated license of an upstream divergence, and the project rule requires a recorded decision for that. The fix is mechanical and touches no code: apply the iteration-3 parent-line texts (and the iteration-1 D-PG9-16 texts) to `09-CONTEXT.md` and `PROJECT.md`. After that, the four overrides above cite recorded decisions, and the status can move to `human_needed` for the maintainer review items.

---

_Verified: 2026-11-15T02:10:00Z_
_Verifier: Claude (gsd-verifier)_

## Gap closure (orchestrator, 2026-11-15)

The records gap is closed by 32557c7c: D-PG9-14, D-PG9-15 and D-PG9-16 are recorded in 09-CONTEXT.md and PROJECT.md Key Decisions, D-PG9-02 and D-PG9-05 are corrected, the D-PG9-03 fail-closed addition is recorded, and the pending-review list is updated. The change is planning-only, so the phase gate at bea13012 still covers the code.
