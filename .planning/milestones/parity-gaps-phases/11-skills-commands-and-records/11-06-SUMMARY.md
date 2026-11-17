---
phase: 11-skills-commands-and-records
plan: "06"
subsystem: records
status: complete
tags: [docs, backlog, PG-DOC-02, D-PG11-10, D-PG11-11]
requires:
  - 11-05 (wave order only; no code dependency)
provides:
  - the corrected statements of the eight PRD section 10 rows marked "none"
affects:
  - the PG-DOC-01 page of the last plan (no shared lines)
tech-stack:
  added: []
  patterns:
    - dated "Out of date 2026-11-15" paragraphs that keep the original record
key-files:
  created: []
  modified:
    - docs/research/claude-hooks-vs-pi-events.md
    - docs/mcp-compatibility.md
    - docs/env-vars.md
    - docs/prd/pi-claude-marketplace-prd.md
    - .planning/BACKLOG.md
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - features/mcp-server/sources.feature
decisions:
  - "The `docs/env-vars.md` footnote mark for the `PATH` rows is `♦`, the seventh mark of the page; mdformat and the other pre-commit hooks keep it."
  - "The Pi 1.5.0 path note of `docs/mcp-compatibility.md` is stated once in full at the Pi built-in paragraph of the introduction; the source-location paragraph under the features table points back to it."
requirements-completed: []
metrics:
  duration: ~35m
  completed: 2026-11-15
actuals:
  tokens: 23600
  tasks: 3
  commits: 3
plan_head_before: a4381f036477cfac004fee724c40d9bf0de44036
plan_head_after: 253ce6dba633376b7a512e5d2beaa4475f361c96
---

# Phase 11 Plan 06: Correct the records that no requirement owns Summary

The eight statements that PRD section 10 marks "none" now match their sources. Each correction
names its source and version, and the two claims that only a run can settle (the codemode reach
and the `/reload` rebuild order) are marked unmeasured. No behavior changed, so no scenario was
added; the three source files changed in `//` comment lines only.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 11-06-01 | 95862404 | docs: correct the stale records that no requirement owns |
| 11-06-02 | d2ababfb | docs(planning): correct four backlog premises |
| 11-06-03 | 253ce6db | docs(mcp): correct the bundle reason and the Pi paths in comments |

## Rows

| # | Place changed | Corrected statement | Mark |
| --- | --- | --- | --- |
| 1a | `docs/research/claude-hooks-vs-pi-events.md`: status line, executive summary "Surface comparison", new section "Amendment 2026-11-15", one sentence under the events table heading | Pi 1.5.0 and Pi 1.5.2 each have 41 extension events; the table lists the 31 events of Pi 0.73.x | Read: Pi 1.5.0 counted in `dist/core/extensions/types.d.ts` (41 `on(event: "...")` lines, `grep -c`); Pi 1.5.2 cited from the hooks report |
| 1b | same file: the two executive-summary bullets on first-party use, the amendment, and pointers at the repeats (Path forward items 1 and 4, the coverage Summary paragraph, Findings bullets 1 and 2, Open questions on E-bucket urgency and V1 scope) | nine distinct events in the official marketplace; `claude-security` uses `PermissionRequest` (not supported) and `UserPromptExpansion` (supported since D-PG6-18); one event in first-party use is not supported; the June 2026 audit of 13 plugins kept as dated data | Cited: the hooks report's parse of seven `hooks.json` files, 2026-11-11; the admitted tuple read in `hook-events.ts` |
| 2 | `docs/mcp-compatibility.md`: Tool search row "Plugin tools reachable with `tool_search` off" (Pi built-in cell `✗` -> `⚠ (docs/mcp.md)`) and the divergence bullet; BACKLOG `TOOLSEARCHOFF-01` | a `codemode` script can still call plugin tools with `tool_search` off, once the user turns `codemode` on; Pi auto-enables `codemode` only for `codemode` exposure and plugin servers are deferred | Unmeasured: read in Pi 1.5.0 `docs/mcp.md`, no scenario |
| 3 | `docs/mcp-compatibility.md`: the bundle paragraph under the server sources table and the divergence row on a bundle path; BACKLOG `MCPB-01`; the comment above `isMcpBundle`; the bundle scenario description | Claude Code has no bundle runner either: it unpacks the bundle and reads a normal server config; the blocker is project work, an unpack step and a manifest translation, bundle `user_config` included (D-CF6-01 kept) | Read: Claude Code plugins reference "MCP bundle path", fetched 2026-11-15 (RESEARCH E3); mcp report N17 |
| 4 | `docs/mcp-compatibility.md`: the Pi built-in paragraph of the introduction (full note) and the source-location paragraph after the features table (pointer); the header comments of `builtin-overrides.ts` and `builtin-mcp-tool-names.ts` | the `dist/extensions/mcp/` paths are right for Pi 1.5.0; since Pi 1.5.1 the tool naming, the config validation, and the OAuth sign-in are in `@earendil-works/pi-mcp` (`dist/naming.js`, `dist/config.js`, `dist/oauth/`) | Read: installed Pi 1.5.0 tree and the `@earendil-works/pi-mcp@1.5.2` file list (RESEARCH F9); the 1.5.1 move cited from the mcp report |
| 5 | BACKLOG `WOUT-01` heading, now "workflow output quality on a real plugin is unobserved", plus one sentence on the existing dated paragraph | a workflow subagent gets `read`, `bash`, `edit`, `write` | Measured on engine 3.15.0 (`features/workflow/agent-steps.feature`, worktree scenario); the 3.13.1 bound read in code, cited from the workflows report; output quality unmeasured |
| 6 | `docs/env-vars.md`: matrix `PATH` row (Hooks `E` -> `E♦`, MCP env `E‡` -> `E‡♦`), new `♦` footnote, the Hooks table and MCP spawn env table `PATH` rows (Claude Code `✓` -> `✗`, note extended) | Claude Code 2.1.323 puts a plugin's `bin` on the `PATH` of the Bash and PowerShell tools only; Pi's process-wide append reaches hooks and MCP servers, more than Claude Code does, a divergence whose change is deferred (D-PG11-10) | Read in the binary, not run (11-SPIKE-S8 Q5) |
| 7 | BACKLOG `UAT-02`, a dated paragraph under the heading | Pi rebuilds the chat before `session_start` on `/reload` (`handleReloadCommand` passes `beforeSessionStart: restoreChatBeforeSessionStart`), so a notice sent during the reload is not erased | Unmeasured: read in Pi 1.5.0 `interactive-mode.js`, not run in a live terminal; the 0.79.10 fix cited from the core report |
| 8 | `docs/prd/pi-claude-marketplace-prd.md`, section 3 `Component` entry | skills, commands, agents supported; hooks supported in part (link to Hook compatibility); workflows supported with a soft dependency on `@quintinshaw/pi-dynamic-workflows`; mcpServers with soft dep; userConfig for declared defaults (PG-CORE-03); the rest unsupported as `domain/unsupported-components.ts` lists them; the `mod`, `binaries`, and plugin `bin` sentences kept | Current product state (README component list) |

Footnote mark chosen for `docs/env-vars.md`: `♦`.

## Lines left as found

- `docs/prd/pi-claude-marketplace-prd.md:92` and `:1066` repeat the old component claim (hooks and userConfig as unsupported) outside the `Component` entry.
- `.planning/ROADMAP.md`, the carried-forward `WOUT-01` line ("workflow output is unobserved"), stays true for output quality.
- `docs/research/claude-hooks-vs-pi-events.md`: "Claude Code has 30 hook events" in the executive summary (the hooks report names 33 for 2.1.322); the `Stop` bullet's "3 of 5 first-party hook-using plugins" (June 2026 data); the Open-questions line on C-bucket use (still true: bucket C is empty).
- `docs/mcp-compatibility.md`: the 31 lines that cite a `dist/extensions/mcp/` path, covered by the one note.
- `docs/env-vars.md`: the Bash children `PATH` row, the matrix's Claude Code cell, and the `stat` rule text under "Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger" (deferred by CONTEXT).

## Verification

- Task 1: `SKIP=npm-check pre-commit run --files` on the four pages: first run mdformat rewrote the tables (column realignment), second run exit 0. The grep verify and the `PATH`/`Component` count verify: exit 0. Every acceptance count matches (`Pi has 31 extension events` 0, `41 extension events` 2, the old first-party sentence 0, `claude-security` 6, `2026-11-15` 13, the two old `tool_search` phrases 0, `has a bundle runner` 0, `@earendil-works/pi-mcp` 1, `codemode` 8, `Bash and PowerShell` 3, `D-PG11-10` 3, `agents (supported), or hooks` 0). The research note's hunks touch no row of the events table or the 13-plugin audit tables. No changed line of `docs/env-vars.md` says parity.
- Task 2: pre-commit exit 0; the verify exit 0; `Out of date 2026-11-15` 4, `restoreChatBeforeSessionStart` 1, `codemode` 2, the old MCPB-01 trigger 0, the old WOUT-01 phrase 0. The only removed heading is the reworded `WOUT-01` one.
- Task 3: `npm run typecheck && npm run check:features` exit 0, no "Feature gate failed"; `npm run test:coverage:direct --` for the three sources exit 0 each; the comment-only diff check exit 0; both `pi-mcp` greps exit 0; `pi-mcp-adapter has no bundle runner` 0, `Neither MCP implementation has a` 0, `D-CF6-01` in the feature 11. The bundle scenario's title, tag, and steps are unchanged. The commit hook ran `npm run check:commit`: Passed.
- `npm run check` was not run; the wave gate runs it.

## Deviations from Plan

**1. [Rule 2 - Correctness] One sentence added to the `WOUT-01` dated paragraph**
- **Found during:** Task 2
- **Issue:** the plan said to change only the heading, but truths 6 and 10 need the paragraph to name engine 3.15.0 as run and the 3.13.1 bound as read in code; the Phase 8 paragraph names neither.
- **Fix:** appended "The scenario ran engine 3.15.0. The 3.13.1 bound is read in the engine source by `docs/research/parity-gaps/workflows.md`, not run." The paragraph's existing text is unchanged.
- **Commit:** d2ababfb

**2. MCPB-01 trigger sentence reworded in place**
- The acceptance criterion requires the string "Trigger: pi-mcp-adapter adds a bundle runner" to be gone, so the original sentence now reads "The original trigger was a bundle runner in pi-mcp-adapter." and the new trigger sits in the dated paragraph. The entry is kept.

**3. The `builtin-overrides.ts` comment names only the config validation as moved**
- RESEARCH F9 and the mcp report name `validateMcpServerConfig` (not `readConfigFile`) as moved, so the comment says "Since Pi 1.5.1 the config validation is in `@earendil-works/pi-mcp` (`dist/config.js`)" and keeps the Pi 1.5.0 `readConfigFile` path.

## Maintainer review items

- The June 2026 audit read the marketplace of `anthropics/claude-code` (13 plugins); the hooks report parsed `claude-plugins-official` (seven `hooks.json` files). The amendment names both catalogs rather than treating them as one.
- `docs/mcp-compatibility.md` still gives "a Pi capability gap" as the reason for the `tool_search`-off divergence, although registering plugin servers as deferred is this extension's choice; `TOOLSEARCHOFF-01` holds the open question (direct exposure, or document `codemode`).
- D-PG11-10 records the wider `PATH` append as a divergence only; narrowing it stays deferred (core report N5).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
T-11-21 (each correction names its source and version; the codemode reach and the `/reload`
order carry "unmeasured"), T-11-22 (the comment-only diff check passed and the hook ran direct
coverage for the three pairs), and T-11-23 (`docs/env-vars.md` states the two upstream consumers
and Pi's wider append as a divergence, D-PG11-10) are mitigated as planned. T-11-SC: no package
installs.

## Self-Check: PASSED

- FOUND: the nine modified files listed in `key-files`
- FOUND: 95862404, d2ababfb, 253ce6db (ancestors of HEAD)
