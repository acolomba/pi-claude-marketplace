# Goldfish Review Report: Stage 5 (Initial Zoom Out)

**Target:** `docs/prd/parity-gaps-prd.md` (lines 1-855, full file)

## Reviewer Status

| Reviewer                 | Status                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `egm-zoom-out`           | completed                                                                                      |
| `egm-inventive-catalyst` | completed (consulted four of the six context reports; did not open `mcp.md` or `workflows.md`) |

No Blocker. 12 Major, 7 Nit after deduplication.

## Prioritized Findings (Blockers -> Major -> Nits)

### Z-01 The trust gate that CORE-06 adds does not stop the case it describes - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst` (both raised it)
- **Affected Scope:** Section 2 item 9; CORE-06 (lines 697-705); section 8 Pi table (line 753)
- **Discrepancy Description**: CORE-06 is P0 as a "trust gap" and is in the top ten. Its own Notes say the reach is low. Pi asks for trust only for a fixed list of paths, and this extension's project files are not on it. So `ctx.isProjectTrusted()` returns true for a repository that commits `.pi/pi-claude-marketplace/state.json`, which is exactly the attack the "Today" bullet describes. The same cause weakens every existing trust gate (hooks, skills, commands). D-LOC-01 records it as accepted. The PRD files the root cause as an unranked upstream wish.
- **Rationale & Recommendation**: Keep CORE-06 as a cheap consistency fix, and say in section 2 that it does not close the described attack. Pair it with the Pi trust-path request as the root fix, or rank it lower. Option from the inventive lens: have the extension tell real trust from default trust. Treat the project scope as trusted only when Pi holds a saved decision, or the folder has trust-requiring resources and Pi says yes; otherwise ask once and store the answer at user scope. Costs: a second trust prompt that is not Pi's; print, JSON and RPC sessions lose project-scope plugins until approved; it amends D-LOC-01; use of Pi's trust exports by an extension is inferred, not documented.

### Z-02 The most serious possible defect has no ID and no priority - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Section 7.4 "Security question for a spike (S4)" (line 577); section 9 row S4
- **Discrepancy Description**: If the inference holds, a plugin agent that Claude Code restricts to read-only tools holds `bash`, `edit` and `write` when a workflow uses it as an `agentType`. `agentType` is in 7 of 7 official scripts. WF-02 (P1) adds a scenario that proves and promotes that binding. The item is absent from section 2, section 6, and the first milestone, while CORE-06, with low reach, is P0.
- **Rationale & Recommendation**: Give it an ID. Make spike S4 a precondition of WF-02. State the project-side fallback if the engine is not patched, for example an install note or a line in the compatibility page.

### Z-03 The priority tiers admit features with no evidence of use - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Section 6, P1 and P2 tables; line 853
- **Discrepancy Description**: P1 is defined as "a parity gain with evidence of use". Several P1 rows state no use: SKILL-03/CMD-03 ("0 of 40 skills"), CORE-04 ("0 uses locally"), MCP-08 (called "a regression guard"), MCP-09, HOOK-21, HOOK-23 (no use figure). About half of the 32 P2 rows say "0 uses", and several of those are size M to L or near the "no emulator" line: HOOK-07b, SKILL-10, CORE-08, AGENT-07 (c). Line 853 sends all P2 items to the backlog, which makes about 16 speculative features standing work.
- **Rationale & Recommendation**: Apply the tier definitions literally. Zero-use items go to P3 until use is shown. The counts cover 17 of 317 plugins, so a wider count over the catalog is cheaper than building on a guess.

### Z-04 AGENT-01 is called "P0, size S", but its real cost is larger and its premise is not settled - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Section 2 item 3; AGENT-01 (lines 598-607)
- **Discrepancy Description**: AGENT-01 cannot land without HOOK-07a (size M), spike S2, and an acceptance test the harness cannot run (BACKLOG AGTASYNC-01). Its Notes ask whether the probe behind D-CF4-05 ran under `claude -p`; that question decides whether the premise is false. Section 2 item 3 says plugin MCP tools do not work in a foreground child, but the code already forces the background for agents with plugin MCP tools (`backgroundForMcp`, `bridges/agents/convert.ts:971` and `:1035`, D-CF6-10). The remaining gain is narrower: launch-mode parity, and tool hooks inside children.
- **Rationale & Recommendation**: State the residual gain precisely. Size AGENT-01 + HOOK-07a + S2 as one item. Settle the probe question before calling it a P0 false premise.

### Z-05 AGENT-05 keeps two parsers and misses an existing repair for the same failure - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst` (both raised it)
- **Affected Scope:** AGENT-05 (lines 620-629)
- **Discrepancy Description**: The requirement keeps today's line parser as a permanent fallback for when Pi's YAML parser throws on an unquoted description with a colon. That case is "common in plugin agents", so the files most likely to have the quoting bugs take the fallback for the whole file and keep the bugs. The skills bridge already solves the case: `repairSingleLineScalars` (`bridges/skills/frontmatter-degrade.ts:203`), used by `repairUnparseableFrontmatter` (`bridges/skills/stage.ts:93`), re-quotes the one bad line and parses again. Neither the PRD nor the subagents report mentions it.
- **Rationale & Recommendation**: Restate the requirement as behavior: "agent frontmatter is read as YAML, with the same leniency skills have". Name the skills repair path as the reuse candidate. That removes the second parser.

### Z-06 HOOK-01 shows a hook only the first pair of a multi-pair `edit` - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** HOOK-01 Requirement and Notes (lines 310-312)
- **Discrepancy Description**: The Requirement says "the first `edits` pair becomes `old_string` and `new_string`". The Notes list the same point as an open design question, so the requirement contradicts its own notes. With the first-pair rule, a content-checking hook such as `security-guidance` never sees pairs 2 to n, so the P0 fix leaves the same silent bypass for multi-pair edits.
- **Rationale & Recommendation**: Do not fix the first-pair rule in the requirement. Option: run the hook once for one pair, and once per pair for more, with any block blocking the whole call. Costs: more process spawns; hooks with side effects fire several times; one `tool_use_id` repeats across runs; `PostToolUse` needs a matching choice.

### Z-07 HOOK-02 and HOOK-13 may contradict each other, and spike S1 does not ask - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** HOOK-02 (lines 351-354); HOOK-13 (lines 328-331); S1 (line 797)
- **Discrepancy Description**: The enabler is quoted as able to "request one continuation". HOOK-02's acceptance needs two continuations in one run, and HOOK-13 needs eight. If Pi grants one continuation per run, HOOK-02 cannot carry the `Stop` loop and `ralph-loop` regresses. S1 does not ask whether the boundary fires again after a continuation.
- **Rationale & Recommendation**: Add that question to S1. State the fallback now: use the boundary while Pi grants continuations, and today's follow-up re-entry after that or in print mode. HOOK-13's reset counter must then work per continuation, not per run.

### Z-08 WF-03 ranks a local workaround above the structural fix, and does not name existing code - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** WF-03 and WF-02 (b) (lines 542-554)
- **Discrepancy Description**: WF-03 is P1, size M: a static read of script bodies to print notes about options the engine ignores. Its own figures: `effort` in 1 of 7 scripts, `stallMs` in 1, the security-relevant options in 0. Its Notes say a two-line engine patch fixes the two options that matter. The project already parses workflow scripts to an AST in `domain/workflow-script.ts`; the PRD says only "the bridge reads only `meta`", so a planner could build a second reader.
- **Rationale & Recommendation**: Reduce WF-03 to the tool-narrowing note, with the engine patch as the main route. Name `domain/workflow-script.ts` as the existing reader.

### Z-09 Requirements prescribe implementation, against the document's own definition - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** "Requirement" and "Notes" bullets throughout section 7
- **Discrepancy Description**: Lines 11 and 221 define a requirement as "the behavior to build". Many bullets name functions, module placement, and internals: CORE-06 ("`recomputePluginPath` receives `ctx.isProjectTrusted()`"), SKILL-03 ("One shared reader"), HOOK-03 ("Compile ... once as an unanchored `RegExp`"), AGENT-05 ("at the boundary of the raw frontmatter type"), HOOK-02 ("one hidden `custom_message` entry and returns `continue: true`"), the "Touch:" lists, and "a new pure module in `domain/`". The `file:line` citations in "Today" bullets are evidence and are fine.
- **Rationale & Recommendation**: The planning agents named as the audience will read these as decisions. Z-05 and Z-08 are two places where a prescribed design skipped the reuse search. State observable behavior only. Move "Touch" lists and design hints to the reports, or label them non-binding.

### Z-10 HOOK-07a suppresses in the child what HOOK-07b then rebuilds, weaker, in the parent - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** HOOK-07a (lines 334-343); HOOK-07b (line 392)
- **Discrepancy Description**: The PRD states that blocking a `SubagentStop` is not possible and sizes the parent-side version M to L. A background child loads this bridge, which sits at the child's start and settle boundaries and could dispatch `SubagentStart` and `SubagentStop` there, with blocking.
- **Rationale & Recommendation**: Zero official plugins use these events, so do not build it now. Shape HOOK-07a's child check as an event remap table, not a skip list, so the P0 work does not close the door. Costs of the remap: foreground children get nothing; the agent name must reach the child's environment; a blocking hook keeps a detached child alive.

### Z-11 Six requirements extend two separate Claude-to-Pi tool tables that already disagree - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** HOOK-16, AGENT-03, WF-05, AGENT-11, SKILL-09, MCP-02, HOOK-01
- **Discrepancy Description**: The code has two tables: `domain/components/hook-tool-names.ts:107-115` and `TOOL_MAP` at `bridges/agents/convert.ts:77`. The PRD adds entries to each on its own. `Agent` and `Task` go into both as two requirements; `Workflow` and `PowerShell` go to agents only; `ToolSearch` goes to hooks only; SKILL-09 says "the mapped Pi tools" without naming a table; MCP-02 fixes name shortening separately in two places.
- **Rationale & Recommendation**: Consider one domain tool mapping that hooks, agents, and skills all read, landed with HOOK-01. Costs: the consumers differ (hooks need a two-way run-time map, agents need install-time grants with scopes); it refactors two stable modules ahead of P0 fixes; it can become a premature abstraction. At minimum, the PRD should say which table each requirement means.

### Z-12 The PRD corrects about 70 stale statements but not what makes them go stale - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** Section 5; section 10; objective 1 in section 1
- **Discrepancy Description**: Many of the 22 decisions rest on a reason that a later Pi, extension, or Claude Code release made false. The handling is to correct each statement once. This PRD adds a new set of version-pinned facts that will age the same way.
- **Rationale & Recommendation**: Smallest form: each decision whose reason is an external fact records that premise and the version it was checked at, and a floor change re-checks the premises tagged with that dependency. Anything beyond that (scripts that re-check proof anchors) is speculative tooling.

### Z-13 P0 and P1 requirements carry extra knobs that enlarge small fixes - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** HOOK-13, MCP-01, HOOK-14, PI-01, CORE-03 step 2, HOOK-03
- **Discrepancy Description**: HOOK-13 also reads `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`. MCP-01 also reads `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`. HOOK-14 adds "overflow saved to a file". PI-01 adds a setting. CORE-03 step 2 adds an install flag, a new verb, and stored values on the evidence of one plugin whose options all have defaults. HOOK-03 bundles three changes, and only the regular-expression part needs decision 6.
- **Rationale & Recommendation**: Split each rider out, or drop it until a plugin needs it. The comma list and the ignored matcher in HOOK-03 are plain defects and should not wait on decision 6.

### Z-14 The decision gate is wider than needed - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Section 5 (lines 78-105)
- **Discrepancy Description**: The heading says all 22 decisions come "first". Section 11 says only decisions 1, 2, 3, 4 and 6 gate the first milestone. About nine decisions gate P2 items only. Decisions 2 and 3 are close to settled.
- **Rationale & Recommendation**: Order the table by the priority each decision gates, and defer the P2-only ones.

### Z-15 Work items with no ID - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Decisions 7, 14, 20; lines 295, 407-411, 575, 665, 737
- **Discrepancy Description**: Decisions 7, 14 and 20 point to prose paragraphs, not requirements. Five "record it or remove it" divergences, two unnumbered differences, and the dot-file scripts have no ID. The real scope is larger than the stated count.
- **Rationale & Recommendation**: Give each an ID or drop it explicitly.

### Z-16 Sections 8 and 10 copy report content - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Section 8; section 10; the "Not closable today" tables
- **Discrepancy Description**: Section 8 lists about 28 upstream requests, several of which unlock zero-use features. Section 10 has a 26-row table.
- **Rationale & Recommendation**: Keep the requests with use evidence or a dependent requirement (the `parallel()` null slots, the agent tool list, the Pi trust paths, `maxTurns`, the advertise limits), and link to the reports for the rest. Section 10 could be a link plus the rows with no owning requirement.

### Z-17 Counts and cross-references do not agree - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Section 2; section 6; line 855
- **Discrepancy Description**: Section 2 says 76 closable gaps; section 6 has 81 rows. CMDSKILLMD-01, SKILLCLASH-01, CMDINFO-01 and MCP-11 appear in section 7 but not in section 6. WF-05 is listed in two area tables. Line 855 says "Two P0 requirements replace an existing scenario" and then lists three items.
- **Rationale & Recommendation**: Reconcile the counts and state the counting rule.

### Z-18 CORE-08 accepts a phase-sized copy mechanism as the only fix - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** CORE-08 (line 729); decision 19
- **Discrepancy Description**: The harm is disagreement between staged artifacts and the live clone after `marketplace update`. The only remedy offered is a copy per version, size L.
- **Rationale & Recommendation**: Smaller option, size S to M: record the clone commit at install; on `marketplace update`, restage the path-source plugins of that marketplace, or mark them stale in `info`. Cost: restaging makes "autoupdate off" meaningless for path-source plugins.

### Z-19 Two smaller options left unexamined - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** HOOK-03 Notes (line 322); SKILL-04 (lines 247-249)
- **Discrepancy Description**: HOOK-03 treats "a regular expression group has no unsupported-tool signal" as given. SKILL-04 patches text for a layout problem and admits that `../../docs/x.md` still breaks.
- **Rationale & Recommendation**: For HOOK-03, test the compiled pattern at install against the closed set of Claude tool names, and report a group that can never fire. For SKILL-04, the text rewrite is reasonable for P0; if the residual case matters later, stage a plugin's skills under one folder that keeps the original folder names (not verified against Pi's skill discovery).

## What passed

- Context sufficiency: sections 1 to 4 say what is wanted, why, and how far the evidence goes.
- Root problem and project alignment: the two objectives and the "not an emulator" boundary are consistent with the project's stated core value.
- No premature optimization.
- Reuse is named in several places: MCP-02, HOOK-07a, SKILL-04, SKILL-05.
- The zoom-out reviewer confirmed two claims in the source: the repository has no reference to `agent_before_settle`, and `recomputePluginPath` takes no trust input.
- No false compromise found in MCP-01, MCP-02, MCP-06, WF-01, AGENT-01's mechanism, or the CORE-03 step split.
