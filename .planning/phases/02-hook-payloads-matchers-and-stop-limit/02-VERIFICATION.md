---
phase: 02-hook-payloads-matchers-and-stop-limit
verified: 2026-11-16T05:37:57Z
status: passed
score: 55/55 must-haves verified
covered_files: [".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-01-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-01-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-02-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-02-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-03-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-03-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-04-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-04-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-05-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-05-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-06-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-06-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-07-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-07-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-08-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-08-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-09-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-09-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-10-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-10-SUMMARY.md","docs/hooks-compatibility.md","docs/research/claude-hook-config-syntax.md","docs/research/parity-gaps/hooks.md","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts","extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-input-search.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts","extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts","extensions/pi-claude-marketplace/domain/components/hook-events.ts","extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts","extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts","extensions/pi-claude-marketplace/domain/components/hooks/partition.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","features/hook/async.feature","features/hook/matchers.feature","features/hook/mcp-tool-names.feature","features/hook/prompt-and-stop.feature","features/hook/tool-failure.feature","features/hook/tool-use.feature","features/lib/hook-case-tools.ts","features/lib/hook-files.ts","features/lib/hook-mcp-tool-server.ts","features/lib/hook-recorder.ts","features/lib/hook-result-observer.ts","features/skill/model-reads.feature","features/step_definitions/hook/async.steps.ts","features/step_definitions/hook/prompt-and-stop.steps.ts","features/step_definitions/hook/runs.steps.ts","features/step_definitions/hook/tool-use.steps.ts","features/support/world.ts","test/architecture/hook-script-cleanup.test.ts","test/architecture/hooks-cap-notify.test.ts","test/architecture/hooks-translators.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/dispatch.test.ts","test/bridges/hooks/event-adapters.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/exec-result.test.ts","test/bridges/hooks/payloads/post-tool-use-failure.test.ts","test/bridges/hooks/payloads/post-tool-use.test.ts","test/bridges/hooks/payloads/pre-tool-use.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/settle.test.ts","test/bridges/hooks/tool-batch.test.ts","test/bridges/hooks/tool-input-search.test.ts","test/bridges/hooks/tool-input.test.ts","test/bridges/hooks/tool-output-files.test.ts","test/bridges/hooks/tool-output-search-shell.test.ts","test/bridges/hooks/tool-result-files.test.ts","test/bridges/hooks/tool-result-search-shell.test.ts","test/bridges/hooks/wire-protocol.test.ts","test/domain/components/hooks.test.ts","test/domain/components/hooks/matcher.test.ts","test/domain/components/hooks/partition.test.ts","test/domain/hooks-resolution.test.ts","test/domain/plugin-resolver.test.ts","test/fixtures/hooks-pretooluse-matcher-mix.json","test/integration/hooks-result-boundary.test.ts","test/orchestrators/plugin/info.test.ts","test/orchestrators/plugin/install-flow-ledger.test.ts"]
covered_digest: "v4:sha256:afb52d686ff8a13de189ef6c4578833a48a91c121465285ea302742f2f1c3106"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "02-09 key link: settle.ts -> runtime.ts via agent_settled consumes the exact continuation transition and one cap notice"
    reason: "Superseded by decision D-PG5-01 (Phase 5): Stop runs on agent_before_settle and a block continues the same run; the loop cap of D-PG2-11 moves unchanged. The link still holds through beforeSettleHandlerFor -> runStopBucket -> continuesBounded -> recordStopReentry (settle.ts:183,482,629; runtime.ts:489). Only the Pi event in the link's 'via' text changed."
    accepted_by: "project decision D-PG5-01 (PROJECT.md decision log, outcome Good)"
    accepted_at: "2026-11-14T15:39:39Z"
re_verification:
  previous_status: passed
  previous_score: 55/55
  reason: "staleness: Phases 3-11 and the gaps-agents/gaps-mcp merges changed 50 of the 72 covered non-planning files after 2026-11-13T14:14:30Z"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "docs/research/parity-gaps/hooks.md:22 still says 'Stop still uses agent_settled; Phase 5 owns event migration and the cap environment variable.' Since D-PG5-01 (Stop on agent_before_settle) and D-PG5-04 (cap environment variable out of scope), the sentence is out of date. docs/hooks-compatibility.md:33 and :161-181 are correct."
    category: other
    reason: "Records drift from Phase 5, which corrected docs/hooks-compatibility.md but not this research status note. The file has not changed since the prior verification. No Phase 2 truth depends on it, and P10.2 forbids claiming deferred work shipped, which this sentence does not do. To resolve: a one-line records fix that names D-PG5-01/D-PG5-04."
    evidence_status: "reproducible by grep; no test or runtime defect"
decision_coverage:
  honored: 12
  total: 12
  not_honored: []
---

# Phase 2: Hook Payloads, Matchers, and Stop Limit Verification Report

**Phase Goal:** A plugin hook that the project reports as supported gets what Claude Code gives it. Hooks on file tools receive and return Claude-shaped tool input, matchers follow Claude Code's rules, and a Stop hook can block eight times in a row.

**Verified:** 2026-11-16T05:37:57Z
**Status:** passed
**Re-verification:** Yes. The previous report (passed, 55/55, 2026-11-13T14:14:30Z, source `d8930842`) became stale, because later phases changed 50 of its 72 covered non-planning files.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `5fd2706a`. It did not reuse the earlier verdicts. Summaries were not taken as evidence. For each truth, the implementing code, its caller, and the test or scenario that exercises it were read again. Citations below are current line numbers. **H/** means `extensions/pi-claude-marketplace/bridges/hooks/`. `domain/` paths are relative to `extensions/pi-claude-marketplace/`.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `9874efc2`, with Node and a hermetic `PI_CODING_AGENT_DIR` (log `/tmp/pg11-phasegate2.log`). The log was inspected: all static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), plus the unpaired and integration tests and direct coverage (374 merged LCOV records). The adapter profile ran 2094/2094 scenarios and 25908 steps. The builtin profile ran 204/204 scenarios and 2762 steps. The log ends with `exit=0`. `git diff --name-only 9874efc2 HEAD` outside `.planning/` lists only `README.md` and `README.es.md`, so G covers every executable input of the current tree. The project's reuse rule applies, and the suite was not repeated.

**Independent named checks (this pass):** ten single tests were run with `node --import test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '^<name>$' <file>`, each under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR`. Each reported `tests 1, pass 1, fail 0, cancelled 0, skipped 0` (see Behavioral Spot-Checks).

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 2 must-haves |
| --- | --- | --- |
| D-PG5-01 (Phase 5, Good) | `Stop` moved from `agent_settled` re-entry to `agent_before_settle`. A block returns `continue: true` with one hidden `claude-hook-stop-block` entry, so the same run continues. "The loop cap (D-PG2-11) moves unchanged." | SC5 and P09.1-P09.6 still hold on the new event (scenario: 1 run start, 9 model calls, 1 cap notice). The earlier report's note "Phase 2 correctly retains the existing agent_settled path" no longer describes the tree. The 02-09 key link whose `via` names `agent_settled` is carried as **PASSED (override)**. |
| D-PG5-04 (Phase 5) | Cap environment variable stays out of scope. | No change. The cap stays `STOP_OVERRIDE_CAP = 8` (H/runtime.ts:27). |
| D-PG6-04/05 (Phase 6) | Tool events carry `tool_use_id`. Edit pairs get `<id>#<n>` (H/tool-batch.ts:126). | Additive. Per-pair invocations and the single native call are unchanged. Scenario tables gained a `tool use id` column. |
| D-PG6-19 (Phase 6) | `UserPromptExpansion` matcher on `command_name` (`name-set` kind). | Additive. Tool matchers never hold `name-set` (domain/components/hooks/matcher.ts:11-21; H/dispatch.ts:158-171). Stop and UserPromptSubmit still ignore matchers. |
| Phase 3 (PG-HOOK-07a) | `Stop`/`UserPromptSubmit` do not run in a pi-subagents child (H/event-router.ts:1619-1640 `dispatchesInCurrentSession`). | Narrows scope to the main session. SC4 and SC5 are main-session criteria and still hold. |

## Goal Achievement

### Roadmap Observable Truths

| ID | Roadmap truth | Status | Current evidence |
| --- | --- | --- | --- |
| R1 | A recording hook on a one-pair `edit` receives `{"file_path":"{project dir}/a.txt","old_string":"x","new_string":"y"}`, and `Read`/`Write` hooks receive an absolute `file_path`. | VERIFIED | H/tool-input.ts:41,72 (`toHookFileInput`, `toHookToolInput`). H/tool-batch.ts:71 (`editPairViews`). The payloads call the codec at H/payloads/pre-tool-use.ts:53, post-tool-use.ts:75, post-tool-use-failure.ts:73. The recorder asserts exact `tool_input` JSON in `features/hook/matchers.feature:43-48` and `features/hook/tool-use.feature` (pair rows :628-:793, Read scenario :1334). These passed in G. |
| R2 | Blocking on the second pair blocks the call. A Claude-shaped `updatedInput` changes Write bytes on disk. `updatedMCPToolOutput` changes MCP output like `updatedToolOutput`. | VERIFIED | Pair preflight H/dispatch.ts:1126-1229: `Promise.all` at :1148, the stop/block decision at :1188-1193, `decideEditBatch` at :1210. Whole-input replacement H/event-adapters.ts:166. Modern/legacy selection H/dispatch.ts:451-487 (legacy only when the modern field is `undefined` and the tool is MCP, :464-467). Scenarios "A denial of the second edit pair leaves the whole file unchanged" (tool-use.feature:725) and "An MCP result alias replaces the result" (:12) passed in G under both profiles. |
| R3 | `Edit, Write` runs on `write`. `^Ba.*` runs on `bash` and not on `read`. `info` reports the group as supported. An invalid regex drops its group. | VERIFIED | Parser domain/components/hooks/matcher.ts:64 (`parsePattern`), :81 (list split on `\|`/`,` and trim), :92 (`parseMatcher`). Admission domain/components/hooks/partition.ts:35. Runtime H/dispatch.ts:158. Scenarios matchers.feature:6 (Write runs under `Edit, Write \| Read \| Bash`), :70 (`^Ba.*` installs, info shows no reasons, runs on Bash), :108 (`^ba.*` does not fire, so the match is case-sensitive), :130 (invalid regex drops only its group). S6 passed. |
| R4 | A plugin whose `Stop` or `UserPromptSubmit` hook has a matcher installs without `--partial`, and the hook runs. | VERIFIED | `NON_TOOL_EVENT_FIELDS` sets `UserPromptSubmit: null` and `Stop: null` (domain/components/hook-events.ts:198-207). partition.ts:57 returns no drop condition before any regex compile. The Stop dispatch uses `() => true` (H/settle.ts:503-510). UserPromptSubmit `entryFires` returns true (H/dispatch.ts:1508-1523,1618-1635). Scenario matchers.feature:169 "Prompt and Stop hooks ignore even invalid matchers" passed in G. |
| R5 | An always-blocking Stop makes eight re-entries before the limit notice. Ten blocks separated by tool calls are never overridden. | VERIFIED | Cap H/runtime.ts:27,489-501. Reset `recordToolCall` H/runtime.ts:511 runs at H/dispatch.ts:1019-1021, before the empty-bucket exit (:1028) and the proxy exit (`toolEventView` :1588). The cap is consumed in H/settle.ts:629-645 on the `agent_before_settle` path (:183-226) per D-PG5-01. Scenarios prompt-and-stop.feature:130 (9 replies, `stop hook active` false then true x8, cap notice count 1, 1 run start and 9 model calls) and :170 (ten blocks with tool calls, cap notice count 0) passed in G. S3, S4, S7 and S9 passed. |
| R6 | Per-tool results expose the available Claude-shaped fields. A replacement reaches the model without stale structured content. Missing facts are documented. An unsupported input rewrite preserves the original call with a notice, and explicit denial still blocks. | VERIFIED | Projectors H/tool-result-files.ts:171 and H/tool-result-search-shell.ts:126, called at H/payloads/post-tool-use.ts:78-79. Reverse renderers H/event-adapters.ts:256-301. Fallback notice H/event-adapters.ts:375 (category only). Omissions are documented at docs/hooks-compatibility.md:31. S5 passed (installed Pi runner, no stale carrier). |

### Plan Observable Truths

P05.1 merges into R6 and P09.1 into R5, as in the prior report: 6 roadmap + 51 plan entries = 55 merged must-haves.

| ID | Truth (abridged) | Status | Current evidence |
| --- | --- | --- | --- |
| P01.1 | Read hook gets an absolute path, and an accepted rewrite changes the one read call. | VERIFIED | H/tool-input.ts:72,105,221. Commit at H/event-adapters.ts:328-354. Read scenario tool-use.feature:1334 in G. |
| P01.2 | Write path/bytes replaceable. Bash/PowerShell timeouts round-trip s<->ms. | VERIFIED | H/tool-input.ts:62,125,169. Owner `tool-input.test.ts` in G. PowerShell is contract-tested only (doc row :19). |
| P01.3 | An unsupported or malformed rewrite keeps the original input and gives a category-only notice. Stop, deny and rejected ask still block. | VERIFIED | H/tool-input.ts:221. H/event-adapters.ts:333-336 (ask), :350-352 and :375-385 (`ignored input rewrite (<category>)`). |
| P01.4 | Native `if` reads native fields. Custom and MCP keep their own schema. | VERIFIED | `matchingHooks(bucket, view.event, …)` evaluates on the native event (H/dispatch.ts:260,1141-1147). H/tool-input.ts:72 maps only exact native IDs. |
| P01.5 | Missing optional fields are removed by whole replacement. An unchanged echo keeps the native operation. | VERIFIED | H/event-adapters.ts:166-183 (delete all, then define). :347 skips the write when the decoded value is the original object. |
| P02.1 | Glob/Grep inputs reflect actual semantics. Equivalent rewrites execute. | VERIFIED | H/tool-input-search.ts:38,117,173. Wired via H/tool-input.ts:91,249. |
| P02.2 | Unsupported Grep modes, asymmetric context, conflicting aliases and inexact limits keep the original call with a notice. | VERIFIED | H/tool-input-search.ts:74,87,117. |
| P02.3 | All three tool-event payloads share the input contract, including failure and background delivery. | VERIFIED | Same `toHookToolInput` at pre:53, post:75, failure:73. Background lanes use `TRANSLATORS` (H/dispatch-exec.ts:144,346; H/async-rewake/registry.ts:152). |
| P02.4 | LS keeps its native shape. Custom parameters unchanged. | VERIFIED | H/tool-input.ts:205 (`decodeLsInput`). Doc row :22. |
| P03.1 | Each edit pair gets its own pre-hook before the one native batch. | VERIFIED | H/dispatch.ts:1148-1162 (per-pair runs), awaited before any commit (:1210-1229). |
| P03.2 | Equal or adjacent pairs stay separate, in order. | VERIFIED | H/tool-batch.ts:71 keeps indices. `Promise.all` keeps order. S1 passed. |
| P03.3 | Zero pairs give zero synthetic invocations. Malformed/null input is left to Pi. | VERIFIED | Branch guard H/dispatch.ts:1037-1041 (`Array.isArray(edits)`). `editPairViews` returns `undefined`, so there is no mutation (:1137-1139). |
| P03.4 | Evaluated on the original input. Pair-then-routing order. Per-pair target agreement. | VERIFIED | H/dispatch.ts:1141-1147. H/tool-batch.ts:146-170 (targets compared at :168). S1 passed. |
| P03.5 | Stop, deny or rejected ask blocks the whole call. Target conflicts block even beside an unsupported candidate. | VERIFIED | H/dispatch.ts:1188-1206. The conflict check (tool-batch.ts:168) runs before the `original` fallback (:172). |
| P03.6 | Any unsupported pair gives the whole original call with a sanitized notice, unless a stronger block applies. | VERIFIED | H/dispatch.ts:1218-1228. H/tool-batch.ts:172-174. |
| P03.7 | Reload or cancellation during preflight cannot commit a stale mutation. | VERIFIED | Generation and signal re-checks at H/dispatch.ts:1117,1168,1202. S2 (`reload while an edit ask awaits…`) passed. |
| P04.1 | Success and failure result hooks run once per pair, with one actual result. | VERIFIED | H/dispatch.ts:1325-1332,1371-1410. |
| P04.2 | Post hooks see the original result. One final output. | VERIFIED | Pair events spread the unchanged `event` (H/dispatch.ts:1395-1399). `acceptedToolOutput` selects after all runs (:1347). |
| P04.3 | Sync, async and asyncRewake lanes get the same pair views. Background never rewrites. | VERIFIED | H/dispatch-exec.ts:207-217 (`spawnAndRegister`, fire-and-forget). Shared translators (above). |
| P04.4 | Failure mutations ignored. Cancelled tools give no failure hook. | VERIFIED | H/event-adapters.ts:461-471,505-507. H/dispatch.ts:1235-1237,1310-1313. |
| P05.2 | Edit pair responses share the actual patch. No reconstruction. | VERIFIED | H/tool-result-files.ts:112 (no file read). |
| P05.3 | File result replacements change model-visible text/images, not filesystem effects. | VERIFIED | H/tool-output-files.ts:64,165,197,220. Routed at H/event-adapters.ts:266-268. |
| P05.4 | Redaction removes content, structuredContent and derived details. Later handlers see no stale copy. | VERIFIED | H/event-adapters.ts:238,256-301. `test/integration/hooks-result-boundary.test.ts` in G. S5 passed. |
| P05.5 | Unchanged or invalid replacement keeps the original. Feedback-only append keeps structured data and failure class. | VERIFIED | H/event-adapters.ts:279-284 (deep-equal echo), :437-456 and :490-501 (block keeps `structuredContent` and `isError`). |
| P06.1 | Glob/Grep responses translate emitted results, with no fabricated counts or times. | VERIFIED | H/tool-result-search-shell.ts:17,63,94. |
| P06.2 | Bash exposes actual text/image blocks. PowerShell omits unavailable fields. | VERIFIED | H/tool-result-search-shell.ts:112. |
| P06.3 | Search/shell `updatedToolOutput` reaches the model, including empty and image output. | VERIFIED | H/tool-output-search-shell.ts:152,170,188. Routed at H/event-adapters.ts:270-272. |
| P06.4 | LS stays the native exception. A supplied output path causes no I/O. | VERIFIED | The renderer is limited to exact native names (H/event-adapters.ts:266-272). Paths are treated as data. |
| P07.1 | For MCP, the modern field wins when supplied, and the legacy field applies only in its absence. | VERIFIED | H/dispatch.ts:457-467. H/wire-protocol.ts:297-331 keeps both fields. |
| P07.2 | Legacy alias never mutates built-in/custom non-MCP tools. Failures stay. | VERIFIED | The `mcpTool` gate (H/dispatch.ts:457). The failure path (H/dispatch.ts:1343-1345; event-adapters.ts:505-507). Scenario tool-use.feature:265. |
| P07.3 | MCP/custom keep the native schema incl. images. Replacement removes all old copies. | VERIFIED | H/event-adapters.ts:185-236,286-300. Scenarios :96 and :139. S5 passed. |
| P07.4 | Stable pair/routing order. Last valid candidate wins. | VERIFIED | H/dispatch.ts:459-483 (last non-undefined patch). `Promise.all` order. S1 passed. |
| P07.5 | Modern null/false/0/""/[] count as present. | VERIFIED | `candidate === undefined` test (H/dispatch.ts:465). Scenario :224 (empty modern does not use legacy). |
| P07.6 | Both MCP implementations keep the recovered identity, proxy exclusions and routing-only metadata. | VERIFIED | H/dispatch.ts:1582-1595 (`toolEventView`). H/event-adapters.ts:238 (`routingDetails`). Both profiles passed in G. |
| P08.1 | Lists split on comma/pipe and trim. `Read Write` is one literal. | VERIFIED | matcher.ts:81-86. Scenario matchers.feature:51. |
| P08.2 | No duplicate invocations. A separator-only list matches nothing. | VERIFIED | Set-based `toolNames` (matcher.ts:17,92-128). Empty members dropped. |
| P08.3 | Omitted/empty/`*` match all. A malformed regex drops its group. Null is rejected by the schema. | VERIFIED | matcher.ts:64-77. partition.ts:35-46. |
| P08.4 | Non-list text is one unanchored, case-sensitive RegExp with no flags. | VERIFIED | `new RegExp(raw)` (matcher.ts:74). Scenario :108 (`ash$` fires, `^ba.*` does not). |
| P08.5 | Stable routing order. Alternation never splits. | VERIFIED | The whole pattern is tested at H/dispatch.ts:164-165. S6 passed. |
| P08.6 | UserPromptSubmit and Stop ignore matchers before validation, and run after install and reload. | VERIFIED | hook-events.ts:203-204, partition.ts:57. Scenario matchers.feature:169. |
| P09.2 | A fresh runtime, an empty bucket or an allowed Stop consumes nothing. Equal blocks count separately. | VERIFIED | H/runtime.ts:338-349. H/settle.ts:492-494 (empty bucket), :531 and :546 (reset). S9 passed. |
| P09.3 | Every native tool_call resets the count and notice before the empty-bucket and proxy exits. | VERIFIED | H/dispatch.ts:1019-1021, ahead of :1027-1034 and :1588. S4 and S8 passed. Scenario prompt-and-stop.feature:170. |
| P09.4 | Event order is authoritative. Synthetic pair views do not reset on their own. | VERIFIED | One reset per real `tool_call` (H/dispatch.ts:1019). Pair runs call `runHooks` directly (:1155). |
| P09.5 | Exact bounded count. 0/1/7/8/9 and repeated resets covered. | VERIFIED | The counter stops at the cap (H/runtime.ts:490-498). S3 (100,000 terminal callbacks) and S7 (flags/results across nine Stops) passed. |
| P09.6 | Reload and separate runtimes share no count. A stale-generation completion is rejected. | VERIFIED | Post-await generation re-check H/settle.ts:513-517. Entry guard :193. S10 (`a pending old-generation Stop completion cannot consume a reloaded budget`) passed. Scenario prompt-and-stop.feature:209. |
| P10.1 | Authors can find the input/result maps, missing facts, fallback and evidence links. | VERIFIED | docs/hooks-compatibility.md:9-33. |
| P10.2 | Records describe per-pair effects, regex/list semantics and the eight/ninth boundary without claiming deferred work. | VERIFIED | docs/hooks-compatibility.md:25,33 (eight continuations, ninth overridden, `agent_before_settle`, D-PG5-01/04). See the advisory on the research note. |
| P10.3 | LS passthrough, PowerShell limits and the MCP legacy ambiguity stay explicit. HOOKRESULT-01 stays open. | VERIFIED | docs/hooks-compatibility.md:19,22,27,31. `.planning/PROJECT.md:84-99`. `.planning/BACKLOG.md:5230`. |
| P10.4 | The combined tree passes `npm run check`, and validation rows record the evidence. | VERIFIED | Gate G above (current inputs). `02-VALIDATION.md` unchanged. |

**Score:** 55/55 truths verified (0 present but behavior-unverified). Every runtime truth has behavioral evidence from G or from a named check run in this pass.

### Required Artifacts

`query verify.artifacts` exited 0 for all ten plans: **22/22** declared artifacts exist and are substantive. Wiring was traced by hand above. All 72 previously covered non-planning files still exist. None was deleted or renamed.

### Key Link Verification

`query verify.key-links` again reports 1/20 (exit 1 for each plan). This is the same literal-path heuristic false negative as before: the plans use root-relative paths, and the imports are relative. All 20 links were traced by hand on the current tree:

| Plan | From -> To | Current connection | Status |
| --- | --- | --- | --- |
| 01 | payloads/pre-tool-use.ts -> tool-input.ts | import :20, call :53 | WIRED |
| 01 | event-adapters.ts -> tool-input.ts | import :80, `decodeHookToolInput` :339 before `replaceToolCallInput` :348 | WIRED |
| 02 | tool-input.ts -> tool-input-search.ts | import :5, calls :91,:249 | WIRED |
| 02 | payloads/post-tool-use-failure.ts -> tool-input.ts | import :25, call :73 | WIRED |
| 03 | dispatch.ts -> tool-batch.ts | `editPairViews` :1136, `decideEditBatch` :1210 | WIRED |
| 03 | dispatch.ts -> event-adapters.ts | `adaptToolCallResult` :1109,:1192; `notifyIgnoredToolInputRewrite` :1222; `replaceToolCallInput` :1225 | WIRED |
| 04 | dispatch.ts -> tool-batch.ts | result fan-out `editPairViews` :1326, `editPairToolUseId` :1397 | WIRED |
| 04 | dispatch-exec.ts -> async-rewake/registry.ts | import :80, `spawnAndRegister` :217 | WIRED |
| 05 | payloads/post-tool-use.ts -> tool-result-files.ts | import :26, call :78 | WIRED |
| 05 | event-adapters.ts -> tool-output-files.ts | import :81, call :267 | WIRED |
| 06 | payloads/post-tool-use.ts -> tool-result-search-shell.ts | import :27, call :79 | WIRED |
| 06 | event-adapters.ts -> tool-output-search-shell.ts | import :82, call :271 | WIRED |
| 07 | wire-protocol.ts -> dispatch.ts | `buildMutateFromHso` :297 keeps both fields, consumed by `acceptedToolOutput` :451 | WIRED |
| 07 | dispatch.ts -> event-adapters.ts | `adaptToolResultResult` :473 | WIRED |
| 08 | partition.ts -> matcher.ts | `parseMatcher` :36, `parseNameMatcher` :54 | WIRED |
| 08 | dispatch.ts -> matcher.ts | `matcherFiresOnToolEvent` :158 over `entry.matcher` | WIRED |
| 09 | dispatch.ts -> runtime.ts | `runtime.recordToolCall()` :1020, before the bucket exits | WIRED |
| 09 | settle.ts -> runtime.ts (via `agent_settled`) | Now via `agent_before_settle`: router :1619 -> `beforeSettleHandlerFor` :183 -> `runStopBucket` :482 -> `continuesBounded` :629 -> `recordStopReentry` :635 | PASSED (override): D-PG5-01 |
| 10 | docs/hooks-compatibility.md -> features/hook/tool-use.feature | links at :9 and elsewhere | WIRED |
| 10 | .planning/PROJECT.md -> .planning/BACKLOG.md | D-PG2-07 row :94 links `#hookresult-01-…`, heading at BACKLOG.md:5230 | WIRED |

### Data-Flow Trace (Level 4)

| Value | Source -> consumer | Real data | Status |
| --- | --- | --- | --- |
| Hook `tool_input` | Pi `tool_call`/`tool_result` input -> codec and pair view -> payload translator -> child stdin | Yes. Recorder rows assert the full JSON. | FLOWING |
| Rewritten call | Hook stdout -> wire protocol -> decode / all-pair decision -> whole replacement -> native execution | Yes. File bytes and later-pair block asserted. | FLOWING |
| Hook `tool_response` | Actual content/details/structuredContent -> projectors -> PostToolUse stdin | Yes. No reconstruction. | FLOWING |
| Model-visible replacement | Hook candidate -> renderer -> Pi `tool_result` patch -> downstream observer | Yes. S5. | FLOWING |
| Stop continuation | Last assistant ending -> `agent_before_settle` -> Stop bucket -> bounded transition -> `continue: true` with hidden entry, or cap notice | Yes. Scenario counts and S7/S10. | FLOWING |

### Behavioral Spot-Checks

All runs used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each gave `tests 1 / pass 1 / fail 0 / cancelled 0 / skipped 0`.

| ID | Named test | File | Result |
| --- | --- | --- | --- |
| S1 | reversed hook completion still commits pair rewrites in native order | test/bridges/hooks/dispatch.test.ts | PASS |
| S2 | reload while an edit ask awaits cannot commit a rewrite | test/bridges/hooks/dispatch.test.ts | PASS |
| S3 | keeps terminal Stop callbacks bounded and notifies only once | test/bridges/hooks/runtime.test.ts | PASS |
| S4 | tool calls reset the Stop budget and notice without clearing active or rewake flags | test/bridges/hooks/runtime.test.ts | PASS |
| S5 | an MCP content-only patch clears structured output when public text is unchanged | test/integration/hooks-result-boundary.test.ts | PASS |
| S6 | dispatches match-all, exact MCP, and whole regex matchers in declaration order | test/bridges/hooks/dispatch.test.ts | PASS |
| S7 | the ninth consecutive block is suppressed and warns only once (drives `beforeSettleHandlerFor`) | test/bridges/hooks/settle.test.ts | PASS |
| S8 | a stale native tool callback cannot reset the current Stop budget | test/bridges/hooks/dispatch.test.ts | PASS |
| S9 | applies settle registration, input, and bounded reentry transitions | test/bridges/hooks/runtime.test.ts | PASS |
| S10 | a pending old-generation Stop completion cannot consume a reloaded budget | test/bridges/hooks/settle.test.ts | PASS |
| G | `npm run check` at `9874efc2` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

### Probe Execution

No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` is in scope. Not applicable.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-HOOK-01 | 01-07, 10 | SATISFIED | R1, R2, R6. REQUIREMENTS.md:23 `[x]`, trace :175 Complete. |
| PG-HOOK-03 | 08, 10 | SATISFIED | R3, R4. REQUIREMENTS.md:25 `[x]`, trace :176. Later PG-HOOK-06 builds on part (c) without changing tool matchers. |
| PG-HOOK-13 | 09, 10 | SATISFIED | R5, on the D-PG5-01 event. REQUIREMENTS.md:26 `[x]`, trace :177. REQUIREMENTS.md:167 keeps `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` out of scope. |

No orphaned Phase 2 requirements.

### Decision Coverage

`query check.decision-coverage-verify` exited 0. All trackable CONTEXT.md decisions are honored by shipped artifacts (12/12). D-PG2-11's PROJECT.md row (:98) records the D-PG5-01 timing move and D-PG5-04.

### Test Quality Audit

| Test file | Linked req | Skipped | Circular | Assertion level | Verdict |
| --- | --- | --- | --- | --- | --- |
| features/hook/tool-use.feature, tool-failure.feature, async.feature | PG-HOOK-01 | 0 | No (recorder reads real stdin; expected JSON declared literally) | Behavioral | OK |
| features/hook/matchers.feature | PG-HOOK-03 | 0 | No | Behavioral | OK |
| features/hook/prompt-and-stop.feature | PG-HOOK-13 | 0 | No | Behavioral (full reply/flag sequence, notice count, run and model-call counts) | OK |
| test/bridges/hooks/{dispatch,runtime,settle}.test.ts, test/integration/hooks-result-boundary.test.ts | all | 0 | No | Value / behavioral | OK |

No `.skip`/`.only`/`.todo` markers and no `@skip`/`@wip` tags were found in the scanned hook test and feature files. Disabled tests: 0. Circular patterns: 0.

### Anti-Patterns Found

| Scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| Hooks bridge sources, hook domain, hook features/steps/libs, hook tests, docs/hooks-compatibility.md | Unreferenced TBD / FIXME / XXX | None | No match |
| Same scope | Stubs, empty handlers, orphaned wiring | None | Optional `undefined` returns are defined no-op outcomes with substantive callers |
| docs/research/parity-gaps/hooks.md:22 | Out-of-date status sentence (Stop on `agent_settled`) | Advisory | See below. File unchanged since the prior verification. Not a Phase 2 truth. |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why advisory |
| --- | --- | --- | --- |
| 1 | `docs/research/parity-gaps/hooks.md:22` still says Stop uses `agent_settled` and that Phase 5 owns the event move and the cap environment variable. Both were settled by D-PG5-01 and D-PG5-04. | other | Records drift left by Phase 5. The file has not changed since the prior verification. No Phase 2 truth depends on it, and there is no runtime defect. |

### Human Verification Required

None. Every runtime behavior is covered by real Pi cucumber scenarios in G and by named owner and integration tests run in this pass. PowerShell remains contract-tested only, and LS remains the native-schema exception. Both are documented scope boundaries.

### Gaps Summary

No gaps and no regressions. On the current tree, every roadmap criterion and every plan must-have of Phase 2 still holds, with citations updated to current lines. One mechanism was superseded on purpose: D-PG5-01 moved the Stop continuation from `agent_settled` to `agent_before_settle`, with the eight-block cap and its resets unchanged. The one plan key link whose text names `agent_settled` is carried as a decision override. A one-line records fix in `docs/research/parity-gaps/hooks.md:22` is advised.

---

_Verified: 2026-11-16T05:37:57Z_
_Verifier: Claude (gsd-verifier)_
