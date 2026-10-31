---
phase: 03-claude-code-tool-names-and-tool-search
plan: 02
subsystem: hooks-bridge
tags: [hooks, matcher, mcp-tool-names, if-field, dispatch]

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "Plugin MCP tools delivered as mcp__plugin_<plugin>_<server>__<tool> (03-01 generatedMcpServerKey + toolPrefix \"mcp\")"
provides:
  - "ParsedMatcher tool-set arm carries optional toolPrefixes; mcp__<segment>__.* parses to the prefix mcp__<segment>__ (string ops only)"
  - "matcherFiresOnToolEvent fires a tool-set on toolNames membership or a toolPrefixes startsWith match"
  - "partitionHooks keeps a prefix-form group as supported, so it no longer makes the plugin partially available"
  - "docs/hooks-compatibility.md: server-prefix matcher row, both MCP matcher forms under Tool name mapping, and the mcp proxy-call divergence"
affects: [03-03, 03-04, hooks-bridge, plugin-mcp-tool-names]

actuals:
  tokens: 5890
  tasks: 2
  commits: 1
plan_head_before: 036a977175eba882bb0c5853eca7d52a23a4a083
plan_head_after: f163778f2bfd20df14e72765a1e4d2201cb27065

tech-stack:
  added: []
  patterns:
    - "Per-alternative classification in parseMatcher: classifyAlternative returns regex | tool | prefix | discarded, and parseMatcher folds the results"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - tests/domain/components/hooks/matcher.test.ts
    - tests/bridges/hooks/dispatch.test.ts
    - tests/domain/components/hooks/partition.test.ts
    - tests/bridges/hooks/if-field/index.test.ts
    - docs/hooks-compatibility.md

key-decisions:
  - "The whole-string SAFE_MATCHER_CHARS check moved into the per-alternative classifier; the prefix form is recognized first, and any other empty or unsafe alternative still makes the whole matcher regex (MATCH-02)"
  - "toolPrefixes is set only when at least one alternative was the prefix form, so existing tool-set values compare unchanged"

patterns-established:
  - "mcpServerPrefix (matcher.ts): startsWith mcp__ + endsWith __.* + MCP_SEGMENT on the middle slice; no RegExp from matcher text"

requirements-completed: [ANAME-02]

coverage:
  - id: D1
    description: "mcp__<segment>__.* parses to a server prefix, alone or as one pipe alternative; every other MCP regex form drops as regex; mcp__acme__ is unmapped"
    requirement: ANAME-02
    verification:
      - kind: unit
        ref: "tests/domain/components/hooks/matcher.test.ts#ANAME-02: parses mcp__plugin_acme_db__.* as the server prefix mcp__plugin_acme_db__"
        status: pass
      - kind: unit
        ref: "tests/domain/components/hooks/matcher.test.ts#ANAME-02: keeps a server-prefix alternative beside a mapped tool in a pipe matcher"
        status: pass
      - kind: unit
        ref: "tests/domain/components/hooks/matcher.test.ts#MATCH-02: rejects the MCP regex matcher mcp____.*"
        status: pass
    human_judgment: false
  - id: D2
    description: "A PreToolUse hook with a prefix matcher fires on mcp__plugin_acme_db__query and not on mcp__plugin_acme_db2__query, mcp, or a case-mismatched prefix; the pipe form also fires on write"
    requirement: ANAME-02
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/dispatch.test.ts#ANAME-02: a server-prefix matcher fires on the delivered plugin tool and on nothing else (toolName \"mcp__plugin_acme_db__query\")"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/dispatch.test.ts#ANAME-02: a server-prefix matcher fires on the delivered plugin tool and on nothing else (toolName \"mcp\")"
        status: pass
    human_judgment: false
  - id: D3
    description: "partitionHooks keeps a prefix-form group as supported while mcp__* still drops as regex"
    requirement: ANAME-02
    verification:
      - kind: unit
        ref: "tests/domain/components/hooks/partition.test.ts#ANAME-02: keeps a server-prefix MCP matcher group as supported"
        status: pass
    human_judgment: false
  - id: D4
    description: "Literal matcher and if: literal / server-prefix forms fire on the delivered Claude-form names with no production change"
    requirement: ANAME-02
    verification:
      - kind: unit
        ref: "tests/domain/components/hooks/matcher.test.ts#keeps the MCP tool name mcp__plugin_acme_db__query as a matcher member"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/if-field/index.test.ts#ANAME-02: compiles mcp__plugin_acme_db__* to the delivered server prefix and fires only on its tools"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/hooks-compatibility.md states the supported prefix form and the mcp proxy-call divergence in plain English"
    requirement: ANAME-02
    verification: []
    human_judgment: true
    rationale: "Prose clarity of the documentation row and the proxy paragraph is a reader judgment; the rg acceptance checks only prove presence"

duration: 5min
completed: 2026-10-06
status: complete
---

# Phase 3 Plan 02: Hook matchers by MCP server prefix Summary

**Hook matchers of the form `mcp__<server>__.*` now parse to a string prefix and fire on every delivered `mcp__plugin_<p>_<s>__<tool>` tool, alone or inside a pipe matcher; every other regex matcher still drops (MATCH-02).**

## Performance

- **Duration:** 5 min (measured from the first edit to the plan commit)
- **Started:** 2026-10-06T17:16:13Z
- **Completed:** 2026-10-06T17:21:02Z
- **Tasks:** 2 of 2
- **Files modified:** 7

## Accomplishments

- `parseMatcher` classifies each pipe alternative on its own. `mcp__<segment>__.*` with `<segment>` matching `[A-Za-z0-9_-]+` joins `toolPrefixes` as `mcp__<segment>__`. `mcp__*`, `mcp__acme__get_.*`, `mcp__a.b__.*`, `mcp____.*`, `.*`, and any pipe that holds one of them stay `regex`.
- `matcherFiresOnToolEvent` fires a tool-set when `toolNames` has the tool or a `toolPrefixes` entry is a prefix of it (`startsWith`, case-sensitive). The adapter proxy tool `mcp` and `mcp__plugin_acme_db2__query` do not fire `mcp__plugin_acme_db__.*`.
- A hooks.json group with the prefix form stays in `supported`, so the plugin no longer reports `{unsupported hooks}` for it.
- Proof tests show that the literal matcher and the `if:` forms `mcp__plugin_<p>_<s>__<tool>`, `mcp__plugin_<p>_<s>` and `mcp__plugin_<p>_<s>__*` fire on the delivered names.
- The docs list the prefix row and explain that calls made through pi-mcp-adapter's `mcp` proxy tool reach hooks as tool `mcp`.

## Task Commits

The plan commits once, as Task 2 instructs:

1. **Task 1: A PreToolUse hook with matcher mcp__plugin_acme_db__.\* fires on the delivered tool** and **Task 2: Partition, if: proofs, doc rows, and the commit** - `f163778f` (feat)

**Plan metadata:** recorded in the docs commit that carries this SUMMARY.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` - `toolPrefixes` on the tool-set arm, module-private `mcpServerPrefix` and `classifyAlternative`, and `parseMatcher` as a fold over the classified alternatives
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` - prefix arm in `matcherFiresOnToolEvent`, plus its doc comment
- `tests/domain/components/hooks/matcher.test.ts` - ANAME-02 and MATCH-02 cases, plus the delivered-name literal row
- `tests/bridges/hooks/dispatch.test.ts` - an ANAME-02 composite-handler case for each of four events
- `tests/domain/components/hooks/partition.test.ts` - ANAME-02: the prefix group is kept and `mcp__*` is dropped
- `tests/bridges/hooks/if-field/index.test.ts` - ANAME-02 proofs for the `if:` literal and server-prefix forms on delivered names
- `docs/hooks-compatibility.md` - the server-prefix row, the other-wildcards row, the Tool name mapping sentence, and the proxy paragraph

## Verification

- Task 1 verify: `npm run typecheck` exit 0; `node --test` on the matcher and dispatch tests: 108 pass, 0 fail; `npm run test:coverage:direct -- matcher.ts dispatch.ts` exit 0 (100% direct coverage; it prints nothing when it passes).
- Tracer gate: the run is interactive with `end-of-phase` mode and the verify step is automated only. The verify step ran again and passed, so the plan went on to Task 2.
- Task 2 verify: `node --test` on the partition and if-field tests: 32 pass, 0 fail. The last line of the pre-commit log reads `PRECOMMIT_EXIT=0`, and the HEAD subject is `feat(hooks): match MCP server-prefix matchers on delivered tools`.
- `PRECOMMIT_EXIT=0`: `SKIP=npm-check pre-commit run --files` on all 7 files. Pass 1 exit 1 (mdformat realigned the matcher table), pass 2 exit 0, 19 hooks passed.
- `npx fallow audit --base 036a9771`: exit 0, "No issues in 7 changed files".
- Commit hook result: `git commit` on `f163778f` ran the pre-commit pass, and `npm run check:commit` **Passed**. Node v26.10.0.
- Plan verification: `git diff 036a9771 -- extensions tests | rg '^\+' | rg -c 'D-0[3]-[0-9]{2}'` prints nothing.
- Acceptance: `toolPrefixes` appears in both modules; `new RegExp` appears in neither; `ANAME-02` cases appear in all four test files; the docs carry the `proxy` paragraph and the `mcp__<server>__.*` row.

Focused task verification passed; full phase/PR verification pending.

## Decisions Made

- The prefix test runs before the safe-character test inside the per-alternative classifier. A string is safe exactly when each of its `|` alternatives is safe, so for every non-prefix form the result is the same as the whole-string check that ran before.
- The `regex` return still happens as soon as the loop reaches the bad alternative. A discarded alternative that comes before it gets a debug-log line, which the whole-string check did not print. This changes the debug channel only, never the parse result.

## Deviations from Plan

None in scope or behavior. The plan was carried out as written.

- Process note (no file effect): the first `pre-commit run --files $F` ran under zsh, which does not split words, so it checked nothing. It was run again under bash with an explicit file array, and the logged `PRECOMMIT_EXIT=0` comes from that bash run.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-04 is mitigated as planned (string operations plus the fixed `MCP_SEGMENT` check; no `new RegExp`). T-03-05 is accepted and documented in `docs/hooks-compatibility.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ANAME-02 for hooks is complete. Plugin hook matchers in Claude form match the delivered tools, both by exact name and by server prefix.
- A record that is already `partially-installed` only because of a prefix-form matcher keeps its staged hooks subset until the plugin is updated or reinstalled (the plan's flagged assumption; no migration).

## Self-Check: PASSED

- FOUND: all 7 modified files
- FOUND: f163778f (ancestor of HEAD)

---
*Phase: 03-claude-code-tool-names-and-tool-search*
*Completed: 2026-10-06*
