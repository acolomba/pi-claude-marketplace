# Phase 2: Hook Payloads, Matchers, and Stop Limit - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver PG-HOOK-01, PG-HOOK-03 and PG-HOOK-13. Plugin hooks receive and return
Claude-shaped tool inputs, receive translated tool results from the fields Pi
provides, and can replace those results. Matchers follow the approved Claude
rules. Stop hooks get eight consecutive continuations and reset on tool calls.
The user explicitly included result translation in this phase after considering
and rejecting postponement. Complete result capture through execution wrappers
is separate work in BACKLOG HOOKRESULT-01.

This context resolves the open design questions in the PRD's HOOK-01 section and
extends its acceptance to translated results. The planner must carry that scope
into implementation, tests and compatibility records. Phase 1 is complete with
AGTAMBIENT-01 deferred; do not upgrade pi-subagents or reopen that phase here.

</domain>

<decisions>
## Implementation Decisions

### Multi-pair edits — explicitly accepted as a group

- **D-PG2-01:** Present a Pi multi-pair edit as one Claude-shaped hook invocation
  per replacement pair. Use `file_path`, `old_string` and `new_string`; do not
  invent a custom batch payload or show only the first pair. This applies to the
  pre-call and successful/failed result hooks.
- **D-PG2-02:** Complete the pre-hook checks before allowing the original Pi edit
  to execute. Any explicit denial blocks the whole call. Keep Pi's single tool
  execution and batch semantics; do not execute each pair as a separate tool.
- **D-PG2-03:** Apply an accepted rewrite to its corresponding pair. All resulting
  pairs must target the same file. Conflicting file redirects block the batch.
  A pair without a rewrite retains its original target and participates in that
  consistency check. Hook side effects may occur once per pair; this is an
  accepted consequence and must be documented.
- **D-PG2-04:** Result hooks run per pair using the actual batch result. Do not
  invent per-pair execution outcomes. The shared result can therefore appear
  in multiple hook invocations.

### Result translation — explicitly required by the user

- **D-PG2-05:** Include per-tool `tool_response` translation now, using available
  Pi event input, content, details and `structuredContent`. Research the upstream
  schemas for every mapped built-in tool. Produce the known Claude-shaped fields
  and document unavailable fields; do not leave every built-in result as the
  existing raw Pi content array.
- **D-PG2-06:** Translate Claude-shaped `updatedToolOutput` back into the Pi result
  delivered to the model. Preserve image/text content where applicable and ensure
  a replacement cannot leave stale structured content visible to another consumer.
  Honor `updatedMCPToolOutput` for MCP tools as required by PG-HOOK-01. Preserve
  D-BG-405: failed-result hooks do not replace the failed tool result.
- **D-PG2-07:** Translate only facts Pi supplies. Omit and document missing facts;
  do not fabricate zero durations/counts, original file contents, create/update
  status or separated shell streams. The user requested BACKLOG HOOKRESULT-01 to
  investigate and implement execution wrappers for full results later. No such
  wrappers or replacement built-in tool implementations belong in this phase.

### Input mappings and unsupported rewrites

- **D-PG2-08:** Map semantically equivalent input fields in both directions.
  Read/Edit/Write paths are absolute; Edit uses Claude's pair fields; shell
  timeout units must be converted. Research and explicitly specify the supported
  Glob/Grep option mapping rather than equating fields with different meanings.
  Preserve the locked tool-name mapping, including `find`/`Glob` and `ls`/`LS`.
  MCP/custom tool parameters retain their own schema. Keep the existing `if`
  evaluator working with native Pi inputs, separate from the hook-facing view.
- **D-PG2-09:** When a hook returns an input rewrite Pi cannot perform, run the
  original call and emit a notice. This is the user's choice over the recommended
  block behavior. Do not partially apply an untranslatable rewrite. For a batch,
  retain the original call as a whole. Explicit hook denial/stop decisions still
  take precedence. Conflicting file redirects remain blocked under D-PG2-03;
  that earlier accepted rule is distinct from an unsupported option mapping.
  Notices use the repository's mode-selected transport and identify the ignored
  rewrite without exposing sensitive argument values. The planner must document
  this intentional divergence and test it through an actual hook.

### Already-settled matcher and Stop requirements

- **D-PG2-10:** Follow the PRD's matcher decisions 6 and 24: exact lists accept
  spaces and comma/pipe separators; other patterns are unanchored JavaScript
  regular expressions; invalid patterns drop their group. Test the Claude-form
  tool name and report valid regex groups as supported. UserPromptSubmit and
  Stop ignore their matcher. Do not reopen those accepted choices.
- **D-PG2-11:** Eight consecutive Stop blocks continue; the ninth is overridden.
  A model tool call resets the count. Implement on the existing agent_settled
  path; Phase 5 moves continuation to another event. Reading the cap environment
  variable is outside this phase.

### Verification and the agent's discretion

- **D-PG2-12:** Each visible behavior change ships with a cucumber scenario that
  fails without it. Exercise real command hooks, inspect the exact received JSON,
  verify resulting file contents and model-visible replacements, and assert the
  original call plus notice for unsupported rewrites. Automate before requesting
  human testing. All commit hooks and combined-tree `npm run check` gates remain.
- Module boundaries, helper names, plan decomposition and equivalent-field mapping
  details are implementation discretion within these contracts. Do not infer a
  size/budget exception from Phase 1's narrow exceptions for 01-01 and 01-06.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/components/hook-tool-names.ts`: closed eight-tool name mapping and
  custom-name passthrough; source comments on find semantics need rechecking
  against the installed Pi glob-based implementation.
- `bridges/hooks/payloads/pre-tool-use.ts`, `post-tool-use.ts`, and
  `post-tool-use-failure.ts`: current payload translators pass native input;
  successful results pass `event.content` directly.
- `bridges/hooks/event-adapters.ts`: input replacement and output patching; failed
  output rewriting is deliberately ignored under D-BG-405.
- `bridges/hooks/dispatch.ts`: parallel hook execution, ordered outcome folding,
  strongest block/stop result, and Phase 1's shared recovered MCP tool identity.

### Established Patterns

- `if-field/index.ts` reads native `input.path` and shell command fields.
- Async rewake consumes the same payload translators; audit both dispatch paths.
- Pi 1.5.0 result events expose `structuredContent`; returning new `content`
  without `structuredContent` drops stale structured content by the API contract.
- Production modules have paired unit tests and 100% direct coverage. Behavioral
  test conventions and full-gate reuse follow the project skills.

### Integration Points

- `features/hook/tool-use.feature`, `tool-failure.feature` and the existing hook
  model/script fixtures supply the behavioral seams.
- `bridges/hooks/runtime.ts` owns Stop counting; `event-router.ts` connects events.
- Matcher parser/partition/support reporting and runtime dispatch must agree.
- Update compatibility and decision records for the new input/result contracts,
  the unsupported-rewrite notice, and the remaining fields in HOOKRESULT-01.

</code_context>

<specifics>
## Evidence and User Instructions

All observations below are dated 2026-11-12. The installed upstream binary is
`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.322/claude`.
The local Pi package inspected is `node_modules/@earendil-works/pi-coding-agent`
version 1.5.0; research must also account for the project's supported floor.

1. **Edit shape and replacement:** the official index
   `https://code.claude.com/docs/llms.txt` led to
   `https://code.claude.com/docs/en/hooks.md`, fetched on the observation date.
   Edit input uses one file_path/old_string/new_string tuple; updatedInput
   replaces the entire input. Confidence high from current official docs.
   Pi edit has a list of oldText/newText pairs and one path. Upstream has no
   direct counterpart for this Pi batch; D-PG2-01..04 are the user-approved
   mapping, not a claim Claude itself emits these batch events.
2. **Result schemas:** Claude binary offsets 294761509 (patch hunks), 294761795
   (Edit output), 294763997 (Write output), 294793961 (Glob output), 294801723
   (Grep output), 296667386 (Read output union) and 298451898 (shell output).
   Edit includes originalFile, structuredPatch and userModified; Write includes
   type, filePath, content, structuredPatch and originalFile. Confidence high
   for the schema fields; not proof that Pi can supply them.
3. **Pi result boundary:** installed `dist/core/extensions/types.d.ts:1004-1058`
   and `:1129-1136`, plus `dist/core/tools/{bash,read,edit,write,grep,find,ls}`.
   Write returns a success text with no details; shell streams are accumulated
   together; Edit supplies diff/patch; Read and Bash supply structured content.
   Confidence high from source. Full metadata capture remains unresolved and is
   explicitly deferred to HOOKRESULT-01. No post-execution filesystem reread may
   be represented as an observation of the tool's original input data.
4. **Search differences:** Claude Grep head_limit limits rendered lines/entries
   (binary offset 294800612), while Pi limit caps matched rows before context
   expansion (`dist/core/tools/grep.js`). Pi supports literal matching and
   symmetric context; Claude has additional modes/options. Confidence high for
   these differences. The planner/researcher must make the exact supported map
   explicit; missing capabilities are Pi gaps, never silent approximations.
5. **Matchers/Stop:** PRD decisions 6 and 24 and
   `docs/research/parity-gaps/hooks.md` record binary-checked matcher rules.
   The current official hook docs confirm eight continuations and reset on a
   tool call. Confidence high for the documented contract. No new manual test
   is required merely because the earlier report rated the reset medium.

The user accepted all multi-edit recommendations, then explicitly said:
"yes we need to include the translator here" and "translate available fields,
file a backlog item for investigating and implement wrappers for full results".
The final unsupported-input choice was "Run original with a notice".
Do not reinterpret these decisions as deferring all result translation or as
permission to wrap built-in tools in Phase 2.

</specifics>

<deferred>
## Deferred Ideas

- HOOKRESULT-01 in BACKLOG.md: investigate and implement execution wrappers or
  an upstream Pi seam for complete Claude-shaped results; user explicitly asked
  for this follow-up. The backlog entry was committed as e92c2bde.
- AGTAMBIENT-01 / SEED-261112-81c: adopt the published pi-subagents ambient MCP
  fix when available; Phase 1 closed with that acceptance deferred.
- Phase 5's Stop continuation event migration and environment-variable cap
  support remain outside this phase.

</deferred>
