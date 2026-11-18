# API Coverage — Pi tool events and Claude hook protocol

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

The detector returned `detected: true` for the Phase 2 ROADMAP section and the ten PLAN files (signal: “integrate” + “API”). The integrated API is the existing Pi extension tool-event boundary translated to Claude hook input, output, matcher and Stop contracts. This phase does not claim to implement the entire Pi SDK or every Claude hook event. D-PG2-01..12 fix the scope; plans encode the concrete contracts rather than delegating them to research.

| capability | decision | reason |
| --- | --- | --- |
| PreToolUse Read input and updatedInput | INTEGRATE | 02-01-01/03: normalized requested file_path, supported line fields, validated reverse mapping and original-call fallback. |
| PreToolUse Write input and updatedInput | INTEGRATE | 02-01-02: file_path/content round trip through the real native write. |
| PreToolUse Bash and PowerShell input and updatedInput | INTEGRATE | 02-01-02/03: command, seconds/milliseconds conversion, valid finite ranges and explicit unsupported-option policy. |
| PreToolUse Glob input and updatedInput | INTEGRATE | 02-02-01: native find glob semantics and equivalent path/pattern mapping. |
| PreToolUse Grep input and updatedInput | INTEGRATE | 02-02-01: content mode, literal escaping, context aliases, flags and semantically equivalent caps only. |
| PreToolUse Edit pair input and updatedInput | INTEGRATE | 02-03-01..03: every indexed pair, all checks before one native batch, per-pair rewrites, final target agreement and atomic fallback. |
| PostToolUse translated input for all mapped tools | INTEGRATE | 02-02-02 and 02-04-01: executed input, per-pair views and actual shared batch outcome. |
| PostToolUseFailure translated input and actual error | INTEGRATE | 02-02-03 and 02-04-02: every edit pair receives the actual failure; cancellation and failed-output rules remain intact. |
| Synchronous command hooks, plain async hooks and asyncRewake delivery | INTEGRATE | 02-04-03: common translators and pair views; late async replies do not retroactively mutate executed calls. |
| Native input conditions and actual tool identity | INTEGRATE | 02-01-03, 02-03 and 02-08: if predicates retain original native input; matching uses the existing canonical identity boundary. |
| Deny, stop, ask and unsupported-rewrite precedence | INTEGRATE | 02-01/03: all authorization outcomes precede any mutation; conflict blocks precede untouched whole-call fallback. |
| Mode-selected ignored-rewrite notice | INTEGRATE | 02-01/03: one sanitized notice through the existing notification strategy; argument values never enter it. |
| Read text/image tool_response | INTEGRATE | 02-05-01: actual text/image facts, conservative line counts and omission of unavailable original size/dimensions. |
| Edit tool_response | INTEGRATE | 02-05-01: pair input fields plus decoded actual batch patch; no fictional pair-specific result. |
| Write tool_response | INTEGRATE | 02-05-01: actual successful filePath/content; unknown create/update/original metadata stays absent. |
| Glob and Grep tool_response | INTEGRATE | 02-06-01/03: actual complete path records or rendered content, evidence-based truncation/counts and ambiguous-text preservation. |
| Bash and PowerShell tool_response | INTEGRATE | 02-06-01/03: verified fields and actual Pi facts; combined streams stay combined. The Bash object migration includes dispatch-exec exact serialization and the successful-tool row in tool-failure.feature in the same task. |
| Claude-shaped updatedToolOutput for mapped file/search/shell tools | INTEGRATE | 02-05-02/03 and 02-06-02/03: validate and render accepted text/images/empty replacements; clear old structuredContent and output-derived details. |
| Native-shaped LS input and result passthrough | INTEGRATE | 02-02, 02-06 and 02-10 retain the locked LS identity and document the unresolved current upstream schema. |
| Custom and MCP schemas | INTEGRATE | 02-07-02/03: native parameter/result shapes, safe explicit patch fields and no built-in codec inference from key names. MCP envelope projection and all mcp-tool-names.feature response expectations change together in 02-07-02. |
| MCP updatedMCPToolOutput alias | INTEGRATE | 02-07-01..03: actual recovered MCP identity only, modern-field presence takes precedence, falsy values preserved, legacy evidence ambiguity documented. |
| Multiple result replacements | INTEGRATE | 02-04/07: deterministic pair/routing order, last valid accepted result, malformed later candidates cannot erase an earlier valid replacement. |
| Phase 1 adapter and builtin MCP identity/profile contracts | INTEGRATE | 02-07 and 02-08 retain canonical recovery, long names, proxy exclusions and whole-record assertions. Both real profiles check the migrated envelopes before the 02-07-02 commit; the generic observer from 02-05 is reused unchanged. |
| Exact tool matcher lists | INTEGRATE | 02-08-01: comma/pipe separators, surrounding ASCII spaces, internal spaces remain literal and duplicate alternatives do not duplicate execution. |
| Whole-pattern tool matcher regex | INTEGRATE | 02-08-02: unanchored case-sensitive JavaScript RegExp without added flags; valid groups supported, compilation failures drop their group. |
| Ignored UserPromptSubmit and Stop matcher fields | INTEGRATE | 02-08-03: ignore before validation, including malformed regex; real installation, invocation and reload scenarios. |
| Stop cap and reset | INTEGRATE | 02-09: blocks one through eight continue, ninth overrides; every native tool call and runtime reload reset the count. |
| Full pre/post builtin capture wrappers | OPT-OUT | Explicitly deferred by D-PG2-07 to BACKLOG HOOKRESULT-01; this phase translates facts the current Pi event supplies. |
| Invented current Claude LS schema | OPT-OUT | No authoritative schema was found in research; D-PG2-07 permits no invented fields. Retained passthrough is an explicit compatibility limitation, not a claim of full LS schema parity. |
| Native execution of unsupported rewrite options | OPT-OUT | Pi lacks the requested capability (for example PDF pages, replace_all true, shell background/sandbox bypass and inequivalent Grep modes/caps). D-PG2-09 explicitly chooses original-call fallback plus notice; that fallback is implemented and tested above. |
| Live PowerShell process scenario on this host | OPT-OUT | The executable is unavailable. PowerShell input/output contracts remain covered by pure tests; records must not claim a live run. |
| Stop continuation event move and cap environment variable | OPT-OUT | D-PG2-11 explicitly leaves the existing agent_settled path and assigns these changes to Phase 5. |
| Additional hook events and unrelated payload fields | OPT-OUT | The roadmap assigns other payload/event work to later phases; this phase changes PG-HOOK-01/03/13 only. |
| New MCP companion adoption or wrapper identity model | OPT-OUT | Phase 1 established the two supported implementations and canonical identity. This phase preserves that boundary rather than replacing it. |

No opt-out reduces per-pair hooks, available-field result translation, reverse result replacement, or the required observable scenarios. Unsupported-input fallback and conservative missing-field omission are implemented behavior, not unplanned work.
