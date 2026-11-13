---
phase: 02-hook-payloads-matchers-and-stop-limit
verified: 2026-11-13T14:14:30Z
status: passed
score: 55/55 must-haves verified
covered_files: [".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-01-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-01-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-02-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-02-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-03-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-03-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-04-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-04-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-05-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-05-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-06-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-06-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-07-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-07-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-08-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-08-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-09-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-09-SUMMARY.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-10-PLAN.md",".planning/phases/02-hook-payloads-matchers-and-stop-limit/02-10-SUMMARY.md","docs/hooks-compatibility.md","docs/research/claude-hook-config-syntax.md","docs/research/parity-gaps/hooks.md","extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts","extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-input-search.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts","extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts","extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts","extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts","extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts","extensions/pi-claude-marketplace/domain/components/hooks/partition.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","features/hook/async.feature","features/hook/matchers.feature","features/hook/mcp-tool-names.feature","features/hook/prompt-and-stop.feature","features/hook/tool-failure.feature","features/hook/tool-use.feature","features/lib/hook-case-tools.ts","features/lib/hook-files.ts","features/lib/hook-mcp-tool-server.ts","features/lib/hook-recorder.ts","features/lib/hook-result-observer.ts","features/skill/model-reads.feature","features/step_definitions/hook/async.steps.ts","features/step_definitions/hook/prompt-and-stop.steps.ts","features/step_definitions/hook/runs.steps.ts","features/step_definitions/hook/tool-use.steps.ts","features/support/world.ts","test/architecture/hook-script-cleanup.test.ts","test/architecture/hooks-cap-notify.test.ts","test/architecture/hooks-translators.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/dispatch.test.ts","test/bridges/hooks/event-adapters.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/exec-result.test.ts","test/bridges/hooks/payloads/post-tool-use-failure.test.ts","test/bridges/hooks/payloads/post-tool-use.test.ts","test/bridges/hooks/payloads/pre-tool-use.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/settle.test.ts","test/bridges/hooks/tool-batch.test.ts","test/bridges/hooks/tool-input-search.test.ts","test/bridges/hooks/tool-input.test.ts","test/bridges/hooks/tool-output-files.test.ts","test/bridges/hooks/tool-output-search-shell.test.ts","test/bridges/hooks/tool-result-files.test.ts","test/bridges/hooks/tool-result-search-shell.test.ts","test/bridges/hooks/wire-protocol.test.ts","test/domain/components/hooks.test.ts","test/domain/components/hooks/matcher.test.ts","test/domain/components/hooks/partition.test.ts","test/domain/hooks-resolution.test.ts","test/domain/plugin-resolver.test.ts","test/fixtures/hooks-pretooluse-matcher-mix.json","test/integration/hooks-result-boundary.test.ts","test/orchestrators/plugin/info.test.ts","test/orchestrators/plugin/install-flow-ledger.test.ts"]
covered_digest: "v4:sha256:65bdf3efe08ca61d9f26ea6950ee6ecc49eb6e00c169af07f0571cd3b9674a09"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 12
  total: 12
  not_honored: []
---

# Phase 2: Hook Payloads, Matchers, and Stop Limit Verification Report

**Phase Goal:** A plugin hook that the project reports as supported gets what Claude Code gives it. Hooks on file tools receive and return Claude-shaped tool input, matchers follow Claude Code's rules, and a Stop hook can block eight times in a row.

**Verified:** 2026-11-13T14:14:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Verification Basis

Read all ten plans and summaries, CONTEXT, REQUIREMENTS, ROADMAP, validation, security, review, review-fix and review-disposition records. The summaries supplied scope and claimed outcomes; the verdict rests on actual implementation, callers, complete test assertions, independent named executions, and a reusable passing combined-tree gate. The exact scope contains 48 task/correction commits and 72 changed files, including the six review correction commits. No previous phase verification or accepted override was present.

CodeGraph was used first to trace the implementation. In the tables, **H/** means `extensions/pi-claude-marketplace/bridges/hooks/`; unprefixed hook owner test names mean `test/bridges/hooks/`. Paths under `domain/` are relative to `extensions/pi-claude-marketplace/`.

**Gate G:** `node .codex/gsd-core/bin/gsd-tools.cjs run-with-timeout 2400 -- npm run check`, exit 0, Node v26.13.1, source revision `d893084229f11876c92b4e036a09b112c4002873`, 2026-11-13T13:49:46Z–14:05:05Z. Inspected `/tmp/pg2-final-check.log` and `/tmp/pg2-final-gate.json`: static checks, unpaired tests, integration tests, all 361 direct source/test coverage pairs at 100%, adapter profile 1,869 scenarios / 22,807 steps (seed 567364), and builtin MCP profile 162 scenarios / 2,210 steps (seed 225284) passed. Independent comparison against that revision found no differences outside planning Markdown, no untracked executable inputs, and the same Node version. This satisfies the project skill's same-input reuse rule; the full suite was not repeated. The configured prior-phase regression command is this same gate and includes the 34 Phase 1 owner files.

## Goal Achievement

### Roadmap Observable Truths

All six roadmap success criteria remain in scope. The 51 plan truths add detail; P05.1 is merged into R6 and P09.1 into R5 as restatements. Every source truth is displayed below, but those two are counted once: **55/55 merged must-haves verified; 6/6 roadmap criteria and 51/51 plan entries covered; 0 behavior-unverified.**

| ID | Roadmap truth | Status | Evidence |
| --- | --- | --- | --- |
| R1 | A recording hook on a scripted edit call with one pair receives `{"file_path":"{project dir}/a.txt","old_string":"x","new_string":"y"}` as tool_input; Read and Write hooks receive absolute file_path. | VERIFIED | `H/tool-input.ts:72`, `H/tool-batch.ts:71`, payload translator calls; real recording-hook exact JSON assertions in `features/hook/tool-use.feature` passed in G. |
| R2 | Blocking on the second edit pair blocks the call; Claude-shaped updatedInput changes Write bytes on disk; updatedMCPToolOutput changes MCP output like updatedToolOutput. | VERIFIED | `H/dispatch.ts:922,979`, whole input replacement at `event-adapters.ts:145`, modern/legacy selection at `dispatch.ts:425`; real later-pair denial, Write filesystem, and both MCP profile scenarios passed in G. |
| R3 | Edit, Write matches write; ^Ba.* matches bash but not read, info reports support, and an invalid regex drops its group. | VERIFIED | Exact-list/whole-regex parser and partition admission feed actual Claude-form dispatch; matcher/install/info owners and real `features/hook/matchers.feature` scenarios passed in G; S6 independently verifies mixed routing order. |
| R4 | Stop/UserPromptSubmit hooks with a matcher install without --partial and run. | VERIFIED | `domain/components/hooks/partition.ts:48` ignores their matcher before compilation; `H/event-router.ts:1208,1257` registers execution; real installation and reload scenarios passed in G. |
| R5 | Always-blocking Stop makes eight reentries before the limit notice; ten blocks separated by tool calls are never overridden. | VERIFIED | Runtime cap is eight, count is bounded, native tool reset precedes dispatch exits, settle honors the decision. Independent S3/S4 and exact model-call/notice assertions in `features/hook/prompt-and-stop.feature` passed. |
| R6 | Per-tool results expose available Claude-shaped fields; replacement reaches the model without stale structured content; missing facts are documented; unsupported input preserves the original call with notice, while explicit denial still blocks. | VERIFIED | Projectors, reverse renderers, transactional input decoder, and output-carrier clearing are wired through actual Pi callbacks. Complete result/model/filesystem scenarios, installed Pi boundary tests, and S2/S5 passed; documentation states all omissions. |

### Plan Observable Truths

Runtime claims below use passing behavioral evidence from G or the independent S checks, not symbol presence alone.

| ID | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P01.1 | A real Read hook receives an absolute file_path and its accepted rewrite changes the one native read call. | VERIFIED | `H/tool-input.ts:72,221` maps and decodes Read; `H/event-adapters.ts:307` commits validated input. `tool-input.test.ts` plus real Read rewrite scenarios in `features/hook/tool-use.feature` passed in gate G. |
| P01.2 | Write hooks can replace the file path and bytes written; Bash and PowerShell timeout values round-trip between seconds and milliseconds. | VERIFIED | `H/tool-input.ts:72,134` maps Write path/content and converts seconds/milliseconds. Owner tests and real Write disk assertions passed in G; PowerShell is explicitly contract-tested. |
| P01.3 | An unsupported or malformed rewrite leaves the complete original input intact and reports only tool and field categories; explicit stop, denial, and rejected ask still block. | VERIFIED | `H/tool-input.ts:221` validates before acceptance, including malformed file URLs; `H/event-adapters.ts:338,368` emits category-only notices and preserves denial precedence. Owner and fallback scenarios passed in G. |
| P01.4 | Native if predicates read native path and command fields; custom and MCP parameters keep their own schema. | VERIFIED | `H/dispatch.ts:234,1329` matches predicates against the original native view before serialization; exact native identities in `H/tool-input.ts:72` leave custom/MCP parameters alone. Owner and custom-identity scenarios passed in G. |
| P01.5 | Missing optional mapped fields are removed by whole-input replacement; an unchanged translated echo preserves the native operation. | VERIFIED | `H/event-adapters.ts:145` deletes and replaces the complete input only after decoding; `H/tool-input.ts:221` retains unchanged echoes. Removal/echo assertions passed in G. |
| P02.1 | Glob and Grep hook inputs express the native operation's actual semantics, and accepted equivalent rewrites execute in Pi. | VERIFIED | `H/tool-input-search.ts:38,117,173` maps actual find/grep behavior and reverses equivalent requests; owner tests and real search rewrite scenarios passed in G. |
| P02.2 | Unsupported Grep modes, asymmetric context, conflicting aliases and inexact limits preserve the entire original call with the ignored-rewrite notice. | VERIFIED | `H/tool-input-search.ts:74,87,117` rejects unsupported modes, unequal context, conflicting aliases and inexact limits before mutation. Full-original fallback assertions passed in G. |
| P02.3 | All three tool-event payloads carry the same translated input contract, including failure and background delivery. | VERIFIED | All three payload translators call `toHookToolInput`; `H/dispatch-exec.ts:277` and async registry serialization share those translators. Payload, failure and background tests passed in G. |
| P02.4 | LS retains native input/result shapes as the explicitly unresolved schema exception; custom parameters remain unchanged. | VERIFIED | `H/tool-input.ts:72,221` explicitly preserves LS and non-native custom schemas; `H/payloads/post-tool-use.ts:37,50` preserves native result shape when no supported projector applies. Owner tests passed in G. |
| P03.1 | Each native edit pair receives its own Claude-shaped pre-hook invocation before the one original native batch may execute. | VERIFIED | `H/tool-batch.ts:71` creates indexed pair views; `H/dispatch.ts:922` awaits all prechecks before the single native call. Real pair-recording/denial scenarios passed in G. |
| P03.2 | Equal or adjacent edit pairs remain separate invocations in original pair order; identical values do not deduplicate pairs. | VERIFIED | Pair views retain array indices and duplicates; `Promise.all` retains input order in `H/dispatch.ts:922`. Duplicate-pair owner tests and independent reversed-completion check S1 passed. |
| P03.3 | A zero-pair edit generates zero synthetic pair invocations and retains Pi's validation/execution behavior; one pair produces exactly one invocation, and malformed/null pair input is preserved for Pi to reject without bridge mutation. | VERIFIED | `H/tool-batch.ts:71` returns no synthetic batch for empty/malformed input; `H/dispatch.ts:861` preserves normal native validation. Zero/one/null/malformed assertions passed in G. |
| P03.4 | Every hook is evaluated against original native input; outcome order is pair index then existing routing order regardless of process completion order, with final accepted target equality checked per pair. | VERIFIED | `H/dispatch.ts:922` freezes the original view for every invocation; ordered results feed `H/tool-batch.ts:121`, which compares final per-pair targets. S1 and batch target tests passed. |
| P03.5 | Any stop, explicit denial or rejected ask blocks the whole call; accepted target conflicts block even when another candidate is unsupported. | VERIFIED | `H/dispatch.ts:979,986` resolves stop/block/ask before commit; `H/tool-batch.ts:154` checks target conflicts before unsupported fallback. Mixed-outcome owner and real later-pair denial tests passed in G. |
| P03.6 | Any unsupported pair rewrite discards every proposed rewrite and runs the original whole call with a sanitized notice, unless a stronger block applies. | VERIFIED | `H/tool-batch.ts:158` chooses whole-original fallback; `H/dispatch.ts:1011` distinguishes stronger conflict blocks and emits a sanitized notice. Unsupported-pair and precedence tests passed in G. |
| P03.7 | Reload or cancellation during preflight cannot commit any stale or partially decoded mutation. | VERIFIED | `H/dispatch.ts:913,963,993` rechecks generation/signal after asynchronous execution and authorization. Independent reload-during-ask check S2 and cancellation owner tests passed. |
| P04.1 | Successful and failed result hooks run once per edit pair, and all receive the one actual native batch result or error. | VERIFIED | `H/dispatch.ts:1078,1136` fans out pair inputs with one actual success/error; real successful and failing native batch scenarios passed in G. |
| P04.2 | All post hooks observe the original actual result, regardless of an earlier hook's proposed replacement; one final output is returned. | VERIFIED | `H/dispatch.ts:1136` passes unchanged actual result carriers to every hook; `acceptedToolOutput` selects only after outcomes return. Original-result/last-valid tests passed in G. |
| P04.3 | Sync, plain async and asyncRewake lanes receive the same per-pair input and actual-result views; background output never retroactively rewrites an executed call. | VERIFIED | `H/dispatch-exec.ts:185,207` and `async-rewake/registry.ts:230` serialize the same selected pair view. Background lanes return noop to synchronous dispatch; async/failure scenarios and registry tests passed in G. |
| P04.4 | Failure output mutations remain ignored and cancelled tools do not manufacture failure hook invocations. | VERIFIED | `H/dispatch.ts:1097` suppresses cancelled failures; `H/event-adapters.ts:470` rejects failure mutation. Failure owner tests and native-failure scenarios passed in G. |
| P05.1 (merged) | Read, Edit and Write result hooks receive known Claude-shaped fields from actual Pi event facts, with unavailable facts omitted. | VERIFIED | `H/tool-result-files.ts:112,130,171` projects only actual result/input facts and omits unavailable ones. Owner tests, full result-recording scenarios and G verify roadmap R6's file-result portion. |
| P05.2 | Edit pair responses share the actual batch patch and contain their corresponding oldString/newString; original file contents are never reconstructed after execution. | VERIFIED | `H/tool-result-files.ts:112` uses that pair's input and the shared actual diff; it performs no post-execution file read. Pair response/diff tests and real pair-result scenarios passed in G. |
| P05.3 | Claude-shaped file result replacements change the model-visible content, including text and images, without altering completed filesystem effects. | VERIFIED | `H/tool-output-files.ts:64,165,197` renders validated replacement text/images; `H/event-adapters.ts:235` returns a result patch. Real model-output and unchanged-filesystem scenarios passed in G. |
| P05.4 | Accepted redaction removes original content, structuredContent and output-derived details; a subsequent Pi handler observes no stale payload copy. | VERIFIED | `H/event-adapters.ts:235` clears output-derived details and structured carriers; installed Pi runner assertions in `test/integration/hooks-result-boundary.test.ts` and full downstream observer scenarios passed in G. |
| P05.5 | An unchanged or invalid replacement preserves the original complete result; feedback-only append preserves original structured content and failure classification. | VERIFIED | `H/tool-output-files.ts` returns no patch for unchanged/invalid candidates; `H/event-adapters.ts:449` preserves structured data and failure state for feedback-only append. Owner/boundary assertions passed in G. |
| P06.1 | Glob and Grep hook responses translate actual emitted search results without fabricated total counts, elapsed times or ambiguous filenames. | VERIFIED | `H/tool-result-search-shell.ts:17,63,94` uses emitted text and actual metadata, omitting ambiguous counts/paths. Search projector owner tests and real result scenarios passed in G. |
| P06.2 | Bash exposes actual combined text/image blocks through Claude's structuredContent array and known metadata; PowerShell omits unavailable separate streams and the unsupported Bash-only array field. | VERIFIED | `H/tool-result-search-shell.ts:112` emits actual Bash text/image blocks; PowerShell omits the Bash-only array and unavailable separate streams. Owner tests passed in G; no live PowerShell claim. |
| P06.3 | Search and shell updatedToolOutput values reach the model, including deliberate empty output and supplied image blocks, with no stale original payload. | VERIFIED | `H/tool-output-search-shell.ts:152,170,188` renders valid empty/text/image replacements; `H/event-adapters.ts:235` removes stale carriers. Owner/boundary tests and model-visible scenarios passed in G. |
| P06.4 | LS remains the explicit native-shaped result exception, and a replacement-provided output path never causes a filesystem or network read. | VERIFIED | `H/tool-output-search-shell.ts:188` only translates exact supported native tools and treats supplied output paths as data. LS/custom and path-without-I/O assertions passed in G. |
| P07.1 | For an identified MCP tool, updatedToolOutput wins whenever supplied; updatedMCPToolOutput is used only when the modern field is absent. | VERIFIED | `H/wire-protocol.ts:263` preserves both fields; `H/dispatch.ts:425` checks modern presence before legacy fallback, only for identified MCP calls. Alias/precedence tests and both-profile scenarios passed in G. |
| P07.2 | The legacy alias never mutates a built-in or custom non-MCP tool, and neither output field replaces a failed result. | VERIFIED | `H/dispatch.ts:425` gates legacy selection on actual MCP identity; `H/event-adapters.ts:470` keeps failures immutable. Built-in/custom/failure assertions passed in G. |
| P07.3 | MCP/custom content and structured results retain their native schema, including text and images; accepted replacement removes every original payload copy. | VERIFIED | `H/event-adapters.ts:183,235` handles native custom/MCP schemas, images and complete carrier replacement. Independent installed-runner same-text redaction check S5 plus G passed. |
| P07.4 | Output selection is stable in pair then routing order, chooses the last valid accepted candidate, and is independent of process completion order. | VERIFIED | `H/dispatch.ts:253,1136` keeps pair/routing order through Promise.all; `acceptedToolOutput` retains the last effective valid candidate against the original result. S1 and ordered output tests passed. |
| P07.5 | Modern null, false, zero, empty string and empty arrays are present values, not permission to select the legacy field. | VERIFIED | `H/dispatch.ts:425` uses `!== undefined`, not truthiness, for modern presence; falsy/null/empty candidate tests passed in G. |
| P07.6 | Both MCP implementations preserve Phase 1 recovered identity, proxy exclusions and routing-only metadata after output replacement. | VERIFIED | `H/dispatch.ts:1329` preserves recovered MCP identity and proxy exclusions; `H/event-adapters.ts:217` retains only server/tool routing metadata. Both adapter and builtin MCP cucumber profiles passed in G. |
| P08.1 | Exact lists split on comma or pipe and trim ASCII surrounding spaces; Read Write remains one literal, not two tool names. | VERIFIED | `domain/components/hooks/matcher.ts:4,56,71` distinguishes exact grammar, splits comma/pipe and trims surrounding ASCII spaces. Owner and `Read Write` literal scenarios passed in G. |
| P08.2 | Repeated exact alternatives or adjacent separators do not duplicate a hook invocation; empty alternatives are discarded and a separator-only list matches no tool rather than all tools. | VERIFIED | Matcher alternatives are a Set, empty tokens discarded; an empty Set matches nothing. Deduplication/adjacent-separator owner and runtime tests passed in G. |
| P08.3 | Omitted, empty and star matchers match all; malformed regex drops its group; schema-invalid null retains the existing parser rejection behavior. | VERIFIED | `matcher.ts:56` handles omitted/empty/star and invalid compilation; the existing schema rejects null. Parser, partition and install/info tests passed in G. |
| P08.4 | Non-list patterns are one unanchored, case-sensitive JavaScript RegExp with no added flags or Unicode normalization; valid groups install and report supported. | VERIFIED | `matcher.ts:63` compiles the whole non-list string without flags or added anchors; `partition.ts:35` admits valid regex groups. Regex/install/info scenarios passed in G. |
| P08.5 | Repeated matching uses the same stable routing order, and regex alternation never splits into independent exact-list tokens. | VERIFIED | `H/dispatch.ts:154,234` evaluates the whole parsed regex and preserves bucket order. Independent repeated mixed matcher order check S6 and owner assertions passed. |
| P08.6 | UserPromptSubmit and Stop ignore every matcher before validation, including invalid regex, and their groups run after installation and reload. | VERIFIED | `domain/components/hooks/partition.ts:48` ignores matchers for those events before validation; event router registers input/settled dispatch. Real install/reload scenarios in `features/hook/matchers.feature` passed in G. |
| P09.1 (merged) | Consecutive blocking Stop decisions one through eight continue the run; decision nine is overridden with the limit notice. | VERIFIED | `H/runtime.ts:18,276` permits exactly eight reentries, then one cap notice; `H/settle.ts:456` consumes that decision. S3 and real Stop scenarios passed; this restates roadmap R5's boundary. |
| P09.2 | A fresh runtime, an empty Stop bucket or an allowed Stop starts with no consumed continuations; equal adjacent blocking decisions count separately. | VERIFIED | `H/runtime.ts:183,186` owns/reset its counter; `H/settle.ts:309` handles empty/allowed buckets. Exact-count, repeated equal block and no-op/allow tests passed in G. |
| P09.3 | Every native model tool_call resets the continuation count and cap notice before empty-bucket or proxy exits, even for a Stop-only plugin. | VERIFIED | `H/dispatch.ts:838,843` resets on a current native tool event before empty/proxy exits; pair views stay inside that dispatch. S4 and Stop-only real tool-reset scenarios passed. |
| P09.4 | Event order is authoritative: tool then Stop starts at one, while Stop then tool clears that prior count; synthetic edit pair views do not reset independently. | VERIFIED | `H/dispatch.ts:843,922` resets once per real tool event; settle then consumes subsequent blocks. Event-order/pair-count owner tests and real interleaving scenarios passed in G. |
| P09.5 | The count stays an exact bounded integer with no rounding or numeric overflow; tests cover 0, 1, 7, 8 and 9 and repeated resets. | VERIFIED | `H/runtime.ts:276` stops incrementing at eight. S3 exercises 100,000 terminal callbacks; S4 proves reset reuse. Owner boundary assertions include 0/1/7/8/9. |
| P09.6 | Reload and separate runtime instances cannot share a continuation count or accept a stale-generation Stop completion. | VERIFIED | State lives inside each runtime; router reload resets settle state, and `H/settle.ts:342` rejects stale completions. Runtime/router/settle reload, separate-instance and generation tests passed in G. |
| P10.1 | Plugin authors can find the exact supported input/result maps, missing facts and original-call fallback behavior, with links to executable evidence. | VERIFIED | `docs/hooks-compatibility.md` provides forward/reverse maps, omitted fields, fallback conditions and specific feature/test links; links and described contracts were checked against the code above. |
| P10.2 | Compatibility records describe per-pair side effects/shared results, regex/list semantics and the eight/ninth Stop boundary without claiming deferred work shipped. | VERIFIED | Compatibility and research status notes describe original batch side effects/shared results, whole regex/list rules and eight/ninth boundary consistently with the owners and scenario assertions. |
| P10.3 | LS passthrough, unavailable live PowerShell evidence and modern/legacy MCP source ambiguity remain explicit, while HOOKRESULT-01 remains open for full capture wrappers. | VERIFIED | `docs/hooks-compatibility.md`, `.planning/PROJECT.md:88-95` and `.planning/BACKLOG.md:5198` explicitly retain LS, PowerShell evidence limits, MCP source ambiguity and open HOOKRESULT-01. |
| P10.4 | The combined tree passes npm run check at the phase/final handoff and every validation row records actual command, exit status, commit, Node version and scope. | VERIFIED | Gate G is a recorded passing combined-tree command with unchanged executable inputs and Node; `02-VALIDATION.md` records all 29 task rows and wave/phase evidence. The corrected 02-02 filter has a real nonempty five-scenario result. |

### Required Artifacts

Ran `query verify.artifacts` for every plan: all ten commands exited 0, covering **22/22 declared artifact entries**. Manual review additionally checked substance and use; repeated artifacts below are separate plan declarations.

| Plan | Artifact | Expected substance and actual wiring | Status |
| --- | --- | --- | --- |
| 01 | H/tool-input.ts | Complete forward/reverse native codec, called by payloads and mutation adapter; accepted/unsupported discriminant precedes commit. | VERIFIED |
| 01 | features/hook/tool-use.feature | Real command-hook input and disk-effect scenarios use recorder and actual Pi tools; executed in G. | VERIFIED |
| 02 | H/tool-input-search.ts | Semantic search mapping and validation, called from the shared input codec. | VERIFIED |
| 02 | features/hook/tool-failure.feature | Actual failing tools deliver translated inputs and shared batch failure; executed in G. | VERIFIED |
| 03 | H/tool-batch.ts | Indexed pair views and whole-batch rewrite decision, called by edit preflight/result dispatcher. | VERIFIED |
| 03 | features/hook/tool-use.feature | Later-pair denial, target conflict, fallback and original-call assertions execute through Pi in G. | VERIFIED |
| 04 | features/hook/tool-failure.feature | Real native batch failure reaches every pair; failure mutation remains ineffective in G. | VERIFIED |
| 04 | features/hook/async.feature | Command hooks record translated pair views in async and asyncRewake lanes in G. | VERIFIED |
| 05 | H/tool-result-files.ts | Available-fact file result projectors called from PostToolUse payload construction. | VERIFIED |
| 05 | H/tool-output-files.ts | Validated reverse result rendering called by the tool-result adapter. | VERIFIED |
| 05 | features/lib/hook-result-observer.ts | Downstream extension records complete content/details/structuredContent/isError after production handlers. | VERIFIED |
| 05 | test/integration/hooks-result-boundary.test.ts | Imports installed Pi runner and observes actual post-hook carrier state; executed in G and S5. | VERIFIED |
| 06 | H/tool-result-search-shell.ts | Projects real emitted search/shell results through the payload builder. | VERIFIED |
| 06 | H/tool-output-search-shell.ts | Validates/renders reverse search/shell output through the result adapter. | VERIFIED |
| 07 | H/exec-result.ts | Mutation type carries both modern and legacy fields consumed by wire decoding and dispatch. | VERIFIED |
| 07 | features/hook/tool-use.feature | Native custom/MCP schemas, aliases, precedence and complete redaction scenarios pass in both profiles. | VERIFIED |
| 08 | features/hook/matchers.feature | Real install/info/reload/runtime matcher scenarios executed in G. | VERIFIED |
| 08 | domain/components/hooks/matcher.ts | Shared exact-list/whole-regex parser feeds install partitioning and runtime routing. | VERIFIED |
| 09 | H/runtime.ts | Runtime-local bounded counter and explicit reset/notice state consumed by dispatcher and settle handler. | VERIFIED |
| 09 | features/hook/prompt-and-stop.feature | Exact model-call and hook-row counts distinguish eight/ninth behavior and tool resets in G. | VERIFIED |
| 10 | docs/hooks-compatibility.md | Current forward/reverse contract, omissions, accepted fallbacks and executable evidence links agree with code. | VERIFIED |
| 10 | .planning/phases/02-hook-payloads-matchers-and-stop-limit/02-VALIDATION.md | 29 actual task records, wave/gate results and scoped limitations; final passing gate independently cross-checked. | VERIFIED |

### Key Link Verification

Ran `query verify.key-links` for every plan. Its literal-path heuristic found 1/20 and exited 1 for each plan: the remaining 19 entries reported “Target not referenced in source.” Inspection resolves these as heuristic false negatives: the plans name root-relative files, while imports use relative paths, some contracts cross an intermediate dispatcher, and the PROJECT link is relative Markdown. These results were not accepted as proof of wiring or ignored; all twenty connections were traced below.

| Plan | From → To | Actual connection | Status |
| --- | --- | --- | --- |
| 01 | H/payloads/pre-tool-use.ts → H/tool-input.ts | Relative import of toHookToolInput; invocation at payload line 41 precedes JSON serialization. | WIRED |
| 01 | H/event-adapters.ts → H/tool-input.ts | decodeHookToolInput validates the complete proposal before replaceToolCallInput. | WIRED |
| 02 | H/tool-input.ts → H/tool-input-search.ts | Exact native find/grep branches call shared search mapping and decoding. | WIRED |
| 02 | H/payloads/post-tool-use-failure.ts → H/tool-input.ts | Failure payload line 59 calls the same translator as success/preflight. | WIRED |
| 03 | H/dispatch.ts → H/tool-batch.ts | runEditPreflight uses editPairViews and decideEditBatch; await precedes commit. | WIRED |
| 03 | H/dispatch.ts → H/event-adapters.ts | authorizeEditPairs uses authorization handling; accepted final input uses whole replacement; ignored rewrites use the notice adapter. | WIRED |
| 04 | H/dispatch.ts → H/tool-batch.ts | Result dispatcher creates pair views while retaining one actual native result/error. | WIRED |
| 04 | H/dispatch-exec.ts → H/async-rewake/registry.ts | Background execution calls spawnAndRegister with selected tool view; both lanes use TRANSLATORS. | WIRED |
| 05 | H/payloads/post-tool-use.ts → H/tool-result-files.ts | fileToolResponse handles supported file tool results at payload line 62. | WIRED |
| 05 | H/event-adapters.ts → H/tool-output-files.ts | Exact native file identities invoke reverse renderer before returning a Pi result patch. | WIRED |
| 06 | H/payloads/post-tool-use.ts → H/tool-result-search-shell.ts | Search/shell projector is called at payload line 63 after file projection. | WIRED |
| 06 | H/event-adapters.ts → H/tool-output-search-shell.ts | Supported native search/shell outputs call the reverse renderer; custom IDs remain custom. | WIRED |
| 07 | H/wire-protocol.ts → H/dispatch.ts | buildMutateFromHso retains both fields in HookExecResult; executor returns it to acceptedToolOutput. | WIRED |
| 07 | H/dispatch.ts → H/event-adapters.ts | Candidate selection calls the actual result adapter; validation and carrier clearing decide accepted output. | WIRED |
| 08 | domain/components/hooks/partition.ts → matcher.ts | Tool group admission calls parseHookMatcher; ignored prompt/Stop matcher path precedes it. | WIRED |
| 08 | H/dispatch.ts → domain/components/hooks/matcher.ts | Routing entries carry the parsed matcher from partitioning; matcherFiresOnToolEvent evaluates its exact/regex form. | WIRED |
| 09 | H/dispatch.ts → H/runtime.ts | Current native PreToolUse event calls recordToolCall before empty-bucket/proxy exits. | WIRED |
| 09 | H/settle.ts → H/runtime.ts | reenterBounded calls recordStopReentry and consumes reenter/notifyOverride; allowed Stop resets sequence. | WIRED |
| 10 | docs/hooks-compatibility.md → features/hook/tool-use.feature | Specific executable input/result/pair scenario citations resolve to the feature. | WIRED |
| 10 | .planning/PROJECT.md → .planning/BACKLOG.md | D-PG2-07 links BACKLOG.md#hookresult-01-investigate-and-implement-execution-wrappers-for-full-claude-shaped-hook-results. | WIRED |

### Data-Flow Trace (Level 4)

No database is required for this extension. The real sources are Pi tool events, executed filesystem effects and hook process replies.

| Artifact / value | Source → transformation → consumer | Produces real data | Status |
| --- | --- | --- | --- |
| Hook tool_input | Pi native tool_call/result.input → exact-native codec and pair view → payload translator → serialized child-process stdin; recorder reads fd 0. | Yes; scenarios assert full recorded input. | FLOWING |
| Native rewritten call | Hook stdout JSON → wire protocol → complete reverse validation / all-pair decision → whole input replacement → original Pi tool execution. | Yes; file bytes and later-pair block are asserted through actual Pi execution. | FLOWING |
| Hook tool_response | Actual event content/details/structuredContent plus executed input → available-fact projectors → PostToolUse stdin. | Yes; no reconstructed original file, fabricated count or static success result. | FLOWING |
| Model-visible replacement | Valid hook candidate → tool-specific/native-schema renderer → Pi tool_result patch → installed runner → downstream observer and model messages. | Yes; tests check original carrier removal, images, empty replacements and same-text MCP redaction. | FLOWING |
| Stop continuation/notice | Actual settled event → blocking result → runtime-local bounded decision → sendMessage reentry or mode-selected cap notice; native tool event resets sequence. | Yes; real scenario call counts and notices plus S3/S4 prove transitions. | FLOWING |

### Behavioral Spot-Checks

Independent checks ran named tests with TAP output showing **one executed test, one pass, zero failures/cancellations/skips** per command. Every command completed in under three seconds. No service was started.

Command prefix for S1–S6:
`node --import "$PWD/test/platform/isolated-pi-home.ts" --test --test-isolation=none --test-reporter=tap --test-name-pattern '<exact name below>' <file>`

| ID | Named behavior / command argument | File | Observed result |
| --- | --- | --- | --- |
| S1 | reversed hook completion still commits pair rewrites in native order | test/bridges/hooks/dispatch.test.ts | PASS, exit 0; reverse completion still commits original pair order. |
| S2 | reload while an edit ask awaits cannot commit a rewrite | test/bridges/hooks/dispatch.test.ts | PASS, exit 0; resolving authorization after reload leaves input unmodified. |
| S3 | keeps terminal Stop callbacks bounded and notifies only once | test/bridges/hooks/runtime.test.ts | PASS, exit 0; eight reentries, ninth notice, 100,000 subsequent terminal calls remain bounded and quiet. |
| S4 | tool calls reset the Stop budget and notice without clearing active or rewake flags | test/bridges/hooks/runtime.test.ts | PASS, exit 0; exhausted budget resets and a fresh eight/ninth sequence works without unrelated flag loss. |
| S5 | an MCP content-only patch clears structured output when public text is unchanged | test/integration/hooks-result-boundary.test.ts | PASS, exit 0; installed runner and downstream handler see no old details/structured payload. |
| S6 | dispatches match-all, exact MCP, and whole regex matchers in declaration order | test/bridges/hooks/dispatch.test.ts | PASS, exit 0; mixed matching retains declaration order. |
| G | Full combined-tree command recorded above | Root package scripts and both cucumber profiles | PASS, same executable inputs and Node; reused once under project policy. |

### Probe Execution

No plan declares a runnable `probe-*.sh`, and no conventional `scripts/*/tests/probe-*.sh` exists in scope. Step 7c shell-probe execution is not applicable. The source audit's thirteen “probe truths” are edge-case acceptance criteria, not missing shell artifacts: `02-VALIDATION.md` maps them to owner/scenario assertions exercised by G. They include zero/equal/malformed pairs, delayed completion and reload, bounded counters/resets, exact regex/list semantics, and complete replacement boundaries. Executor PASS-marker claims were not used as execution proof.

### Requirements Coverage

| Requirement | Source plans | Contract | Status | Evidence |
| --- | --- | --- | --- | --- |
| PG-HOOK-01 | 01–07, 10 | Claude-shaped tool input and effective updatedInput; every edit pair checked; legacy MCP output honored. | SATISFIED | R1/R2/R6, input and output codecs, complete edit preflight/result fanout, real recorder/filesystem/model scenarios, both MCP profiles and S1/S2/S5. |
| PG-HOOK-03 | 08, 10 | Exact-list/whole-regex matcher admission and execution; ignored Stop/prompt matcher; invalid regex group exclusion; supported info status. | SATISFIED | R3/R4, shared parser/partition and dispatch, real installation/info/reload scenarios, S6. |
| PG-HOOK-13 | 09, 10 | Eight consecutive blocks allowed; native tool activity starts the counter again. | SATISFIED | R5, runtime/settle/tool callback wiring, real exact-count scenarios, S3/S4. |

All plan requirement IDs are accounted for. REQUIREMENTS maps exactly these three IDs to Phase 2; there are no orphaned Phase 2 requirements. Its abbreviated PG-HOOK-03 text says “commas or spaces”; REQUIREMENTS explicitly gives the PRD precedence. PRD section 7.2 and accepted D-PG2-10 specify comma/pipe alternatives with surrounding spaces trimmed and internal spaces literal, which is what the parser and tests implement. This is not an unapproved grammar change.

The REQUIREMENTS checkboxes and phase trace statuses were still Pending during verification; completion bookkeeping belongs to the orchestrator and is not evidence of missing implementation.

### Decision Coverage and Test Quality

`query check.decision-coverage-verify` exited 0: all **12/12** trackable CONTEXT decisions honored, no missing or contradicted decisions. Manual traces above substantiate the result. Plans contain no prohibition entries, backstop-only truths or deferred `<human-check>` blocks requiring resolution.

Test quality was checked at the assertion boundary:
- The recording hook reads actual JSON stdin and records the whole value; expected values are independently declared, not generated by the production codec.
- The result observer registers after the production extension and records complete content, details, structuredContent and isError. The installed-runner integration test reaches Pi's real result merge behavior.
- Stop scenario helpers compare the complete expected model-call sequence, full hook rows, absence of overflow and cap-notice count. They would fail on one/three/nine continuations or accidental tool-reset omissions.
- Reverse-completion and delayed-authorization tests control actual promises and assert final input, not merely that a helper was called.
- No skipped/focused test marker or unreferenced debt marker was found in the exact changed-file scope. The source/test owners and real cucumber scenarios cover the changed public command behavior.

The previous review's four runtime bugs and one documentation issue were checked against the corrected code, not treated as closed solely from the review disposition: same-text MCP carrier clearing (S5), native Glob output alias handling, malformed file-URL fallback, exact native/custom identities, and matcher prose now agree with implementation and assertions. The clean rereview and 27/27 closed security recheck provide corroborating evidence.

No specific undeclared precondition, incidental ordering or fixture-only state was needed for the verified truths. Production code establishes ordering through await/Promise.all and explicit pair indices, owns reset/generation state, and obtains the same native input/result facts that the test fixtures supply.

### Anti-Patterns Found

| Scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| All 72 changed files | Unreferenced TBD / FIXME / XXX | None | No debt-marker blocker. |
| Changed implementation and test owners | Placeholder output, empty implementation, console-only action, orphaned wiring, disabled tests | None | No stub or disconnected user-visible value found. Optional projector no-match/unsupported returns, empty initial collections and deliberate empty replacement values have substantive callers and defined behavior. |
| Whole-regex matcher | Native JavaScript regex complexity | Accepted scoped residual | Existing explicit contract permits whole JavaScript regex; no phase requirement claims a regex sandbox or execution timeout. The security recheck records this residual. |

### Human Verification Required

None. Runtime behavior is covered by executed owner/integration tests and real Pi cucumber scenarios; the contract documentation was independently reviewed against those implementations. Generic summary human-judgment labels do not introduce an unresolved visual or external-service check for this phase.

PowerShell remains contract-tested because live PowerShell execution is unavailable in the accepted environment; the phase explicitly requires that limitation to be stated. LS is the accepted native-schema exception. Neither is silently counted as demonstrated live parity. Partial result projection intentionally omits facts Pi never supplied; execution wrappers remain open as HOOKRESULT-01. These are accepted scope boundaries, not missing current-phase artifacts.

### Later-Phase Scope and Gaps

No blocking gaps or unresolved warnings were found. Full-roadmap review confirms Phase 5 owns Stop event migration and the cap environment variable; Phase 2 correctly retains the existing agent_settled path. No failed current-phase truth was moved to a later phase to obtain this verdict.

**Phase goal achieved within the recorded D-PG2-01..12 contract.** All runtime-dependent truths have passing behavioral evidence. No overrides were applied, no human decision is pending, and no source or completion-state file was changed by this verification.

---

_Verified: 2026-11-13T14:14:30Z_
_Verifier: gsd-verifier_
