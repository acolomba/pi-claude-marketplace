---
phase: 10-plugin-options-variables-and-trust
plan: "20"
subsystem: records
status: complete
tags: [records, trust, user-config, changelog, backlog, upstream]
requires: ["10-03", "10-04", "10-06", "10-11", "10-18", "10-19"]
provides:
  - "Key Decisions rows D-PG10-01, -04, -06, -11, -16, -19, -23, -24 in .planning/PROJECT.md, each pending maintainer review"
  - "D-LOC-01 gated list holds PATH and says Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2); PENV-01 and its Validated bullet corrected (D-PG10-03); D-CF5-15 amended by D-PG10-10"
  - ".planning/upstream/pi-extension-trust-paths.md, not filed"
  - "BACKLOG PITRUSTPATHS-01, HOOKOPTFAIL-01, REDACTHOOKPATH-01, CMDSKILLNAME-01, MCPOPTFALLBACK-01; USRCFG-01 amended; BEHAVGAP-01 item 2 marked covered"
  - "six CHANGELOG sub-bullets under the parity-gaps entry of [Unreleased]"
affects: [10-21]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/upstream/pi-extension-trust-paths.md
  modified:
    - .planning/PROJECT.md
    - .planning/BACKLOG.md
    - CHANGELOG.md
decisions:
  - "The project trust gap of D-LOC-01 is confirmed for Pi 1.5.0 and 1.5.2, pending maintainer review: option A taken, option B (an extension-kept consent record) recorded as the safer posture, the gap stays open until Pi lets an extension register a trust path (D-PG10-01)."
metrics:
  duration: "~45 min"
  completed: 2026-11-15
actuals:
  tokens: 7000
  tasks: 3
  commits: 3
plan_head_before: 28f2966c156d5d2b2fd657cf1f87d8391e174d16
plan_head_after: fc6e48667439316a543a09a2af20e16550fa35e0
---

# Phase 10 Plan 20: Records of the trust gap and the plugin option decisions Summary

The trust-gap decision (PG-SEC-02) and seven other pending decisions are in the Key Decisions table, four earlier records carry their amendments, the Pi trust-paths request is drafted and not filed, the BACKLOG holds the waiting entry and four follow-ups, and the CHANGELOG tells users what changed.

## Tasks

| Task | Commit | Files |
| --- | --- | --- |
| 10-20-01 Key Decisions rows and amendments | 25b3b227 | `.planning/PROJECT.md` (+14 -4: eight rows, one blank line, one note, four changed lines) |
| 10-20-02 Pi request and BACKLOG | 01ac2c3a | `.planning/upstream/pi-extension-trust-paths.md` (new), `.planning/BACKLOG.md` (+29 -1) |
| 10-20-03 CHANGELOG lines | fc6e4866 | `CHANGELOG.md` (+6, added lines only) |

All `<verify>` commands exited 0, and each commit passed its hooks. No version file changed (`git diff --quiet 28f2966c -- package.json package-lock.json sonar-project.properties` exited 0). No test ran, as the plan says: this plan changes no code.

## Rows added (PROJECT.md Key Decisions)

- D-PG10-01: confirm the project trust gap (PRD decision 23, security-sensitive, confirms D-LOC-01). Names Pi 1.5.0 and 1.5.2 with source lines, option A with its two licenses, option B with its five costs, the security flag, the residual, PG-CORE-06's narrow gate, reversibility, the draft, and PITRUSTPATHS-01. It says the gap stays open.
- D-PG10-04: step 1 of plugin options (PRD decision 17, amends BACKLOG USRCFG-01). Names the unset-option text "Open /plugin manage to configure it" and the D-PG10-23 security choice as the two other maintainer questions.
- D-PG10-06: a required option with no default gives `options not set`. A malformed `userConfig` reuses `invalid manifest`.
- D-PG10-11: option values reach pi-mcp-adapter through process variables. Bash-tool divergence licensed as AVAR-01, the `${FOO:-${user_config.x}}` gap, and the re-approval prompt.
- D-PG10-16: `${CLAUDE_PROJECT_DIR}` for user-scope skills and commands (PRD decision 10, amends SUB-02 in the title).
- D-PG10-19: a declared default counts as a saved value. More than Claude Code 2.1.323 does, read in the binary and not run. States the maintainer question. No row calls it parity.
- D-PG10-23: the record holds the schema, and project option variables wait for the trust answer. Residual and the faster alternative.
- D-PG10-24: `reinstall`, not `apply`, refreshes an earlier partial install, and the `supported` alternative.

## Amendments

- D-LOC-01: `PATH` joins the list gated on `ctx.isProjectTrusted()`, and the accepted-gap sentence ends with "Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2)."
- PENV-01 (line 745): a `bin` joins only when it exists and is a directory, holds no metacharacter, and for a project plugin only in a trusted project. The earlier rule matched Claude Code 2.1.212 and not 2.1.323 (D-PG10-03).
- The Validated bullet (line 1707) ends with "(corrected by D-PG10-03)".
- D-CF5-15: "Amended by D-PG10-10."
- New last line: the 2026-11-15 note for this phase.

## Draft and BACKLOG

- Draft title: "Pi: an extension cannot make its project files require trust". Issue title: "Let an extension register project paths that require trust". Repository read from the installed `package.json`: `https://github.com/earendil-works/pi`. No home path, no credential, and nothing filed.
- PITRUSTPATHS-01: the trigger, the draft path, and the work it unlocks.
- USRCFG-01: a new head paragraph says step 1 shipped and steps 2 and 3 stay open behind decision 30. It corrects the OS secret custody claim (W4) and lists three step-2 preconditions: the fill at invocation or a guard, the visible option variables, and `apply` with D-PG10-24. The rest of the entry is unchanged.
- BEHAVGAP-01 item 2: covered by `features/plugin/executables.feature`. The uninstall and `/reload` exit is still open.
- From the parent-lines file:
  - (a) REDACTHOOKPATH-01, the `redactAbsolutePaths` bug.
  - (b) HOOKOPTFAIL-01. Upstream check, a static read of the Claude Code 2.1.323 binary: the throw before the spawn becomes `{status: 1, spawnFailed: true}` (`BIN@312883290`). The result loop then yields `Failed with non-blocking status code: <message>` (`BIN@312955146`), and `H9n` gates a repeat (`BIN@312955093`). This supports research E3. The item is open for a decision, because nothing was run.
  - (c) CMDSKILLNAME-01. The skills docs (fetched 2026-11-15) say a skill wins over a same-named `.claude/commands/` file. The plugin case is inferred, not confirmed.
  - (d) MCPOPTFALLBACK-01.

## CHANGELOG lines

```markdown
  - A plugin's `userConfig` options now give their default to hooks as `CLAUDE_PLUGIN_OPTION_<KEY>`, to MCP servers, and to skill, command, and agent content. A plugin whose options all have a default now installs without `--partial`.
  - If you installed a plugin with `--partial` because of its `userConfig`, run `/claude:plugin reinstall` once to give it its options.
  - An MCP server that names a plugin option with no value is left out with a warning. A shell-form hook that names a plugin option does not run.
  - pi-mcp-adapter asks for project server approval again for a server whose entry names a plugin option, after the plugin's next update or reinstall.
  - A user-scope skill or command now gets the project directory for `${CLAUDE_PROJECT_DIR}` when you invoke it or the model reads it.
  - A plugin's `bin` folder now joins `PATH` only when it exists. A project plugin's `bin` folder joins only in a project that Pi trusts.
```

Word counts: 34, 20, 28, 23, 21, 24. The 10-17 re-approval note is the fourth line, so 10-21 does not need to carry it in the CHANGELOG.

## Questions left for the maintainer

- D-PG10-01: option A or option B for the trust gap (security flag).
- D-PG10-19: keep defaults on hooks and content, or follow Claude Code with defaults on MCP only.
- D-PG10-04: whether the unset-option text may keep "Open /plugin manage to configure it".
- D-PG10-23: project-scope option variables wait for the trust answer, or are set in the factory.
- D-PG10-24: `reinstall` or an `apply` growth move for earlier partial installs.
- D-PG10-06, -11, -16: each row's alternative.
- HOOKOPTFAIL-01: the `Failed to run:` prefix against Claude Code's `Failed with non-blocking status code:`.

## Parent-owned lines requested

- PG-CORE-03: 10-19 said to mark it complete if 10-20 and 10-21 own none of it. This plan owns only its records, and 10-21 owns the docs. Mark it complete after 10-21.
- PG-SEC-02: met by the D-PG10-01 row, pending maintainer review (the plan's flagged assumption).
- STATE.md decision: "The project trust gap of D-LOC-01 is confirmed for Pi 1.5.0 and 1.5.2, pending maintainer review: option A taken, option B (an extension-kept consent record) recorded as the safer posture, the gap stays open until Pi lets an extension register a trust path (D-PG10-01)."
- For 10-21 or a later source pass: the `commandVariables` doc comment in `orchestrators/command-invocation.ts` still says "Install already filled the body's path variables (CM-3, SUB-02)", which holds at project scope only (from the 10-03 SUMMARY).

## Deviations from Plan

1. Four more BACKLOG entries, HOOKOPTFAIL-01, REDACTHOOKPATH-01, CMDSKILLNAME-01, and MCPOPTFALLBACK-01, beside the plan's one. The dispatch asked for them. Each has its own heading at the end of the file.
2. The draft cites `dist/main.js:603-607` from the installed 1.5.0, where the first runtime computes trust without the resolver. Research named lines 637 and 650-654, which do not match the installed file. The draft says that the `main.js` lines are from 1.5.0.
3. CHANGELOG: one more sub-bullet, on the left-out MCP server and the refused shell-form hook. Both are user-visible changes of this phase.
4. The plan's verify command for the D-PG10 rows counts "parity" in every row because of the `parity-gaps` label. A read of the rows shows that only D-PG10-06 ("not parity") and D-PG10-19 ("No record calls it parity") use the word.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED
