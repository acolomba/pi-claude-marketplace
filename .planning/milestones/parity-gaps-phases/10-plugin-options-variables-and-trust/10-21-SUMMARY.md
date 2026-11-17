---
phase: 10-plugin-options-variables-and-trust
plan: "21"
subsystem: docs
status: complete
tags: [docs, user-config, path, trust, hooks, mcp]
requires: ["10-03", "10-04", "10-06", "10-11", "10-18", "10-19"]
provides:
  - "docs/env-vars.md: the PATH existence and trust rule, the user-scope project directory, the option rows, the two pi-only option names, and a Plugin options divergence section"
  - "docs/hooks-compatibility.md: the exec-form fill, the unset failure, the shell-form refusal, and the D-PG10-19 divergence"
  - "docs/mcp-compatibility.md: a Plugin options subsection under Variables, and two Variables divergence bullets"
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - docs/env-vars.md
    - docs/hooks-compatibility.md
    - docs/mcp-compatibility.md
decisions:
  - "The commandVariables doc comment in orchestrators/command-invocation.ts is not changed: a correct one-line replacement does not fit the comment's width, so it is reported for a source pass."
metrics:
  duration: "~40 min"
  completed: 2026-11-15
actuals:
  tokens: 25800
  tasks: 2
  commits: 2
plan_head_before: a9745e7f2a6945dddbd8de694657ea0f07cb77ad
plan_head_after: 328dff7d2c4f7982640ad753a33f12b4f87b532d
---

# Phase 10 Plan 21: Documentation for plugin options, PATH, and the user-scope project directory Summary

The three pages now describe what the phase shipped: the `PATH` rule with its existence check and trust gate, the user-scope `${CLAUDE_PROJECT_DIR}` fill, plugin options on hooks, content, and MCP servers, and the two pi-only option names. Each divergence names its decision, and no page calls the default on hooks and content parity.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Correct docs/env-vars.md for PATH, the project directory at user scope, and plugin options | 2016c2e1 | docs/env-vars.md |
| 2 | Correct the hooks page and add the plugin options section to the MCP page | 328dff7d | docs/hooks-compatibility.md, docs/mcp-compatibility.md |

## Sections changed

`docs/env-vars.md`:
- Intro: the option rows and the `PATH` rule follow Claude Code 2.1.323, read in its binary and not run.
- Delivery mechanisms S and E: the user-scope project directory fill (D-PG10-16), `substituteClaudeContent`, the `PATH` existence and trust rule, the option ledger, and `CLAUDE_PLUGIN_OPTION_<KEY>` on the hook lanes.
- Overview matrix: new rows `CLAUDE_PLUGIN_OPTION_<KEY>`, `${user_config.KEY}`, `PI_CLAUDE_MARKETPLACE_OPTIONS`, `PI_CLAUDE_MARKETPLACE_OPTION_<hash>`, with a new footnote `◊`. The dagger footnote is rewritten. The `PATH` row's cells are unchanged (only mdformat padding moved).
- Bash children: the `PATH` row (directory at the load, project plugin only when trusted), and rows for the two pi-only names and `CLAUDE_PLUGIN_OPTION_<KEY>` (hooks only).
- Skills, Commands, Agents content: the typed-argument paragraphs, the `${CLAUDE_PROJECT_DIR}` rows (skills and commands filled at user scope; agents still as written), and a `${user_config.KEY}` row in each.
- Hooks, MCP config substitution, MCP spawn env: option rows.
- Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger: the existence rule (metacharacters, `stat`, `ENOENT`/`ENOTDIR`, Windows, next `/reload`, debug log) and the trust gate, stated as applying when Pi's answer is "not trusted" (D-PG10-01).
- New "Pi-only plugin option variables": the name, an example name, the value and its escape, the ledger format, the three apply points, the unreadable-state rule, inheritance by every child, and the D-PG10-23 residual.
- "`CLAUDE_PROJECT_DIR` at user scope": the install-once reason is gone; the three fill points; the agent sentence kept; the MCP and Bash paragraphs kept.
- New "Plugin options" divergence section: D-PG10-19 (more than Claude Code, not parity), D-PG10-06 (the partial arm is a project safety rule), D-PG10-15/D-PG10-24 (`reinstall` once), D-PG10-11.
- "Not delivered": the plugin options line is removed.

`docs/hooks-compatibility.md`:
- "Placeholders in `command` and `args`": the exec-form fill, the unset failure with Claude Code's message and the measured `UserPromptSubmit hook error: Failed to run:` text, the shell-form refusal with its two remedies, the no-`userConfig` rule, and the D-PG10-19 divergence.
- Environment variables table: the `PATH` row, a new `CLAUDE_PLUGIN_OPTION_<KEY>` row, and the `${user_config.*}` status row (now ✓ with the divergence note).

`docs/mcp-compatibility.md`:
- New "Plugin options" under `## Variables`: the five fields, the empty string, the no-`userConfig` rule, the measured adapter argument, the built-in in-memory fill and escape, the fields each profile's scenarios prove, the two left-out cases with the catalog link, the restage paths, the adapter re-approval, and the MCPOPTFALLBACK-01 gap.
- Divergences, Variables: two bullets (Bash inherits the option variables, D-PG10-11; a leading home-path option leaves the server out).

## Claims marked unmeasured

- Every Claude Code 2.1.323 rule (the `PATH` filter, defaults on hooks and content, the per-server catch) is marked as read in the binary and not run.
- The unset-hook prefix: the page states the measured `Failed to run:` and says Claude Code probably shows `Failed with non-blocking status code:`, read and not run (HOOKOPTFAIL-01).
- The `caFile` origin and OAuth header rule with option values: owner unit cases only.
- The built-in escape of a `!echo $HOME` default: owner unit case only.
- The empty string for an option with no default: owner unit cases only.
- The pi-mcp-adapter re-approval: read in its source, not measured.

## Deviations from Plan

1. The `commandVariables` comment fix (dispatch item) was not made. Line 149 of `orchestrators/command-invocation.ts` is `* may name. Install already filled the body's path variables (CM-3, SUB-02);`. Every correct one-line replacement measured 102 to 104 characters, against a comment wrapped near 80, so a correct fix rewraps the paragraph. It is reported below.
2. The hooks page `PATH` row of the environment table was also corrected, so that no page says a `bin` is appended whatever is on disk. It is in this plan's file list.
3. The MCP page gained two divergence bullets under "Variables", besides the subsection, to keep the page's rule that each divergence has an item with its reason.

## Parent-owned lines requested

- `extensions/pi-claude-marketplace/orchestrators/command-invocation.ts:149`: `* may name. Install already filled the body's path variables (CM-3, SUB-02);` holds at project scope only. Suggested text: "Install filled the body's path variables, and the project directory at project scope only (CM-3, SUB-02); at user scope this step fills it (D-PG10-16)", rewrapped. No behavior change.
- `.agents/skills/claude-code-compat-research/SKILL.md:43`: "Kinds this project deliberately does not bridge" still lists `userConfig` (10-RESEARCH "Records to correct" left it to the planner).
- No `README.md` or `README.es.md` line says `userConfig` is unsupported.
- PG-CORE-03: 10-20 said to mark it complete after this plan. This plan owns the docs part, which is done.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-41: each page names the divergence and its ID, and the `PATH` text says the gate applies when Pi's answer is "not trusted". T-10-42: `docs/env-vars.md` documents both names and that every child of Pi inherits them.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: docs/env-vars.md, docs/hooks-compatibility.md, docs/mcp-compatibility.md
- FOUND: 2016c2e1, 328dff7d (ancestors of HEAD)
