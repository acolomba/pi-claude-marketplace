---
phase: 03-claude-code-tool-names-and-tool-search
plan: 09
subsystem: docs
tags: [docs, mcp, divergences, readme]
status: complete

requires:
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: "03-01 keys and toolPrefix; 03-02 hook prefix matchers and the proxy gap; 03-03 the closed table; 03-04 {unsupported mcp} and {malformed mcp}; 03-05 the -/_ fold refusal; 03-06 the info name; 03-07 agent mcp: grants and async: true; 03-08 the plugin-owned timeout rule"
provides:
  - "docs/mcp-compatibility.md: names, tool search, name length measurement, lifecycle, translated and dropped fields, partial and malformed configs, user overrides, hooks and agents, divergences"
  - "README.md and README.es.md: MCP name table (key, tool names, info name), partial-install MCP example, Features link"
affects: [phase-7-adoc-01]

actuals:
  tokens: 8732
  tasks: 2
  commits: 1
plan_head_before: 49cb0cf4617e7b5321ddaef1c14a6e81b6eb5819
plan_head_after: 99dbaddaf5a8e7a16ed114de533964150b80cb7b

tech-stack:
  added: []
  patterns:
    - "MCP compatibility doc follows the house compatibility style: legend, Claude Code and Pi columns, a divergence list with a reason per item"

key-files:
  created:
    - docs/mcp-compatibility.md
  modified:
    - README.md
    - README.es.md

key-decisions:
  - "docs/mcp-compatibility.md is the home of the MCP naming, tool search, length, lifecycle and divergence records; docs cite ANAME-0N, never D-03-NN"
  - "README.es.md carries the same MCP name table, partial-install text and agent MCP rule as README.md (.claude/rules/readme.md)"
  - "The host-only server types get a partial mark in the Claude Code column, because Claude Code accepts them only for connections of its own host"

patterns-established:
  - "Each divergence bullet names its license: a recorded project decision (with its requirement ID) or a Pi capability gap"

requirements-completed: [ANAME-03, ANAME-04, ANAME-05]

coverage:
  - id: D1
    description: "docs/mcp-compatibility.md documents naming, tool search (tool_search off by default, defaultTools setting, no settings edits), the 64-136 measurement and provider limits, the lazy lifecycle divergence, the field table with timeout semantics, dropped fields, partial and malformed configs, overrides, hooks and agents, and the divergence list"
    requirement: ANAME-05
    verification:
      - kind: other
        ref: "rg Divergences|unsupported mcp|http://localhost|28 hours|defaultTools|lazy|128|tool_search docs/mcp-compatibility.md; pre-commit markdownlint-cli2 and mdformat Passed"
        status: pass
    human_judgment: true
    rationale: "Prose accuracy and readability need a human read; no gate binds this document to the code"
  - id: D2
    description: "README Name mapping replaces 'MCP server names do not change' with the key, tool-name and info-name table; Partially available plugins names MCP features; both link the new doc; README.es.md mirrors them"
    requirement: ANAME-03
    verification:
      - kind: other
        ref: "rg plugin_foo_api_ README.md; rg 'MCP server names do not change' README.md (empty)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-06
---

# Phase 3 Plan 09: MCP compatibility docs Summary

**A new `docs/mcp-compatibility.md` records how plugin MCP servers are named (`plugin_<plugin>_<server>_`, `mcp__plugin_<plugin>_<server>__<tool>`, `plugin:<plugin>:<server>`), how the model finds their tools through the adapter's `mcp({ search })` while Pi's `tool_search` stays off unless the user adds `"defaultTools": ["+tool_search"]`, the 64-136 character measurement and the 64/128 provider limits, the `lazy` lifecycle, the closed field table with the 28-hour versus 60-second timeout note, and a reasoned divergence list. The README name table and partial-install text now match the shipped names, in English and Spanish.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-06T19:17:00Z
- **Completed:** 2026-10-06T19:24:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created)

## Accomplishments

- `docs/mcp-compatibility.md` (new) has these sections: Server and tool names, Tool search, Name length, Connection lifecycle, Translated fields, Dropped fields, Partially available plugins, Invalid server configs, User overrides, Hooks and agents, Divergences and documented absences, Further reading.
- The doc describes the shipped behavior from the 03-01 to 03-08 summaries. This includes 03-08's rule that a kept override's own timeout applies again once a later plugin version stops setting one, 03-04's malformed-server divergence, and 03-07's `async: true` requirement.
- The divergence list has eight items: lazy lifecycle, `tool_search` off by default, proxy calls invisible to hooks, the `-`/`_` refusal, a malformed server making the whole plugin unavailable, timeout semantics and default, the trailing `_` on adapter surfaces, and tool-name characters. Each item names its reason.
- README Name mapping: the old "MCP server names do not change" text and table are replaced by the adapter key, tool name and `info` name table (`foo`/`api`, `foo`/`my.db`, `bar`/`api`) and the refusal sentence. Partially available plugins names `ws` and `headersHelper`. Both sections and the Features bullet link the new doc.

## Task Commits

The plan commits once, as Task 2 directs:

1. **Task 1: A reader can find, from the README, how a plugin's MCP tools are named and found (tracer)** - `99dbadda` (docs)
2. **Task 2: Translation, partial and malformed configs, overrides, hooks and agents, the divergence list, the README sections, and the single commit** - `99dbadda` (docs)

**Plan metadata:** recorded in the docs commit that carries this SUMMARY.

## Verification

- Task 1 verify: the four searched terms and the README link were present. `pre-commit run markdownlint-cli2` passed on the tracer gate re-run. The first run failed on two findings. The first was MD060 (table alignment), which mdformat fixed. The second was MD051, a forward link to the Divergences section that did not exist yet. The link was taken out for the tracer gate and put back in Task 2.
- Task 2 verify: `Divergences` and `unsupported mcp` found in the doc, `plugin_foo_api_` found in README.md, `tail -n 1 tmp/p3-09-precommit.log` = `PRECOMMIT_EXIT=0`, HEAD subject `docs(mcp): document Claude Code tool names, tool search and divergences`.
- `PRECOMMIT_EXIT=0` (last line of `tmp/p3-09-precommit.log`, first pass clean; mdformat and markdownlint-cli2 both Passed).
- Commit hook result: `git commit` on `99dbadda` passed all hooks, including gitlint. `npm run check:commit` was skipped as "(no files to check)", because the commit is docs-only.
- Acceptance: `rg -n "MCP server names do not change" README.md` and `rg -n "D-03-" docs/mcp-compatibility.md README.md` print nothing. `http://localhost` prints the OAuth row, and `28 hours` prints the timeout note. `^## ` lists the naming, tool search, name length and lifecycle sections. `defaultTools` prints the setting.
- Focused task verification passed; full phase/PR verification pending.

## Files Created/Modified

- `docs/mcp-compatibility.md` - new MCP compatibility document.
- `README.md` - Features link, Name mapping MCP table, Partially available plugins MCP example.
- `README.es.md` - the same three changes in Spanish, plus the 03-07 agent MCP rule.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - CLAUDE.md-driven] README.es.md updated alongside README.md**
- **Found during:** Task 1
- **Issue:** `.claude/rules/readme.md` requires every change to `README.md` to be applied to each localized README in the same commit. The plan lists only `README.md`. The Spanish README also lacked the 03-07 agent MCP rule, and its override example still used `mcp:github`, which the new keys make wrong.
- **Fix:** The Features link, the Name mapping table and text, and the partial-install text were translated into `README.es.md`. The Customizing generated agents section was synced with the English one: three rules, the `mcp:` mapping bullet, the `mcp:plugin_foo_github_` example and the `mcp:<key>` sentence.
- **Files modified:** README.es.md
- **Committed in:** 99dbadda

**2. [Rule 3 - Blocking] Forward link held back for the tracer gate**
- **Found during:** Task 1 (tracer gate)
- **Issue:** markdownlint MD051 failed on the link to the Divergences section, which Task 2 creates.
- **Fix:** The link was taken out for the Task 1 gate and put back with the Divergences section in Task 2.
- **Files modified:** docs/mcp-compatibility.md
- **Committed in:** 99dbadda

**Total deviations:** 2 auto-fixed (1 CLAUDE.md-driven, 1 blocking). **Impact on plan:** the localized README now matches the English one. No other scope change.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-19 is mitigated: the Tool search section names the exact setting the user may add and states that this extension never edits Pi settings files.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- All nine Phase 3 plans are executed. The phase gate (`npm run check` on the tree) and phase verification are next.
- Phase 7 (ADOC-01) extends `docs/mcp-compatibility.md`.

## Self-Check: PASSED

- FOUND: docs/mcp-compatibility.md
- FOUND: README.md, README.es.md (modified)
- FOUND: commit 99dbadda (ancestor of HEAD)
