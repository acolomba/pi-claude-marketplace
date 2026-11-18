# Goldfish Review Report: Stage 6 (Comprehension Test)

## What this proposes

The document lists the differences found on 2026-11-11 between what Claude Code 2.1.322 does with a plugin and what `pi-claude-marketplace` does with the same plugin on the Pi coding agent. Each difference that can be closed is written as a requirement with an ID, a priority (P0 to P3), a size, and usually an upstream / today / enabler / requirement / acceptance breakdown. Around these it places 22 maintainer decisions to answer first, 11 live-run checks ("spikes") because nothing was run live, change requests for Pi and three companion extensions, a table of wrong statements in the project's own records, and a suggested four-milestone grouping. Nothing in it is approved or scheduled; it is input for planning.

## How the existing system works, per this document

`pi-claude-marketplace` is a Pi extension that installs Claude Code plugins from marketplaces and translates six component kinds into Pi-native artifacts through per-kind "bridges".

- **Skills and commands:** copied ("staged") under generated names. Their arguments, `${CLAUDE_*}` variables and `!` injection are filled when invoked through Pi's `input` event, or through a `run_plugin_command` tool when the model runs them.
- **Hooks:** 10 of 33 Claude events, `command` handlers only, mapped onto Pi extension events.
- **MCP servers:** registered through Pi's built-in MCP or through pi-mcp-adapter.
- **Workflows:** saved into the pi-dynamic-workflows engine.
- **Subagents:** written as agent files for pi-subagents.

A plugin with something unsupported is refused unless installed with `--partial`. Installs are at user or project scope, and project-scope content is gated on Pi's project trust.

The reviewer had to assemble this second paraphrase from the "State of parity" paragraphs; the document has no section that states it (finding C-01).

## Findings

**Target:** `docs/prd/parity-gaps-prd.md` (FeatureRange lines 1-855; DetailedRange N/A)

### Reviewer Status

| Reviewer            | Status                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| `egm-comprehension` | completed (read the target only; no document standard applies to this stage) |

No Blocker: every section could be paraphrased. 12 Major, 14 Nit.

### Prioritized Findings (Blockers -> Major -> Nits)

#### C-01 No description of the baseline system; its core vocabulary is never defined - Severity: Major

- **Affected Scope:** Sections 1-2, and every "Today" line
- **Discrepancy Description**: Section 1 gives two sentences, then the text uses these as known terms: "bridge" / "bridged" / "the hooks bridge" / "the agents bridge", "stage" / "staged", "partial" / "`--partial`" / "partially available" / "the partial model", "install note" versus "warning" versus "staging warning", "user scope" / "project scope", "project trust", and "the reference rewriter". The command surface is never introduced: `info`, `browse`, `list`, `update`, `reinstall`, `apply`, `marketplace update`, `--map-model`.
- **Rationale & Recommendation**: "Partial" matters most: decisions 7 and 8, HOOK-03, CORE-03 and CORE-04 all turn on it, and the nearest thing to a definition is one clause in 7.6 (line 683). Add a short system description and a glossary, or link to one.

#### C-02 Decision and backlog IDs are cited with no statement of where the records live - Severity: Major

- **Affected Scope:** Section 5 and throughout
- **Discrepancy Description**: Section 5 says a divergence is legitimate only when "a recorded decision covers it", but never says where decisions are recorded or what the ID families mean (D-CFn-nn, ANAME, WNAM, SUB, SK, AG, NFR, SC, MATCH-V2, "BACKLOG ..."). The only location is incidental, in section 10. "BACKLOG" is never located. IDs that cannot be interpreted from this text: D-CF7-01 to D-CF7-04 (line 519), NFR-10 (lines 285, 729), SC-1 (lines 217, 735), D-CF1-03 (line 748), HOOKPROXYBOTH-01 (line 499), AGTASYNC-01, WFLENGINE-01, TOOLSEARCHOFF-01, UAT-02.
- **Rationale & Recommendation**: State once where decisions and backlog entries are recorded and how to look up an ID. Give one line of content for each ID that a requirement depends on.

#### C-03 The headline counts and the "full list" do not reconcile - Severity: Major

- **Affected Scope:** Sections 2, 6 and 7
- **Discrepancy Description**: Section 2 says 76 closable gaps and that section 6 "has the full list". Section 6 has 81 rows (13 + 29 + 32 + 7), several with paired IDs. Section 7 has items missing from section 6: CMDSKILLMD-01, SKILLCLASH-01, CMDINFO-01 (lines 292-293), MCP-11 (line 500), and the two unnumbered differences at line 295.
- **Rationale & Recommendation**: The reader cannot tell what the 76 counts. State the counting rule and make section 6 complete.

#### C-04 Section 5 is not the complete decision queue - Severity: Major

- **Affected Scope:** Section 5 versus sections 7.2 to 7.6
- **Discrepancy Description**: Section 5 is presented as the decisions to make "first", but more are scattered and unnumbered: the three hook divergences at lines 407-411; the `thinking` field (line 665); `bin` on `PATH` for hooks and MCP (line 737); dot-file workflow scripts (line 575); `permission_mode` (line 365); the credential difference in MCP-04 (line 498); whether a regular-expression group reports as supported (line 322); the built-in agent type mapping for SKILL-10 (line 289); the "explicit decision" for SKILL-08 (line 291).
- **Rationale & Recommendation**: Number every decision in section 5, or say that section 5 holds only the decisions that reopen a recorded decision.

#### C-05 The requirement template promised in sections 1, 7 and 11 is not kept - Severity: Major

- **Affected Scope:** All section 7 tables and several full entries
- **Discrepancy Description**: Section 11 says the Acceptance line "of each requirement" exists. The table requirements have none, including these P1 items: HOOK-23, HOOK-14, HOOK-21, HOOK-11, MCP-09, AGENT-06, AGENT-09, WF-04, WF-07, CORE-04, CORE-05, CORE-07. MCP-08 has no Upstream and no Acceptance. Many full entries omit Enabler (SKILL-03, CMD-09, HOOK-03, HOOK-13, MCP-05, WF-02, WF-03, CORE-01, CORE-06) while others say "None needed".
- **Rationale & Recommendation**: A reader cannot tell an omission from "none needed". Give every P0 and P1 requirement an Acceptance line, and write "None needed" where no enabler is required.

#### C-06 AGENT-01 is stated as certain, but its own note leaves the evidence in conflict - Severity: Major

- **Affected Scope:** Lines 26, 84, 598-607
- **Discrepancy Description**: Sections 2 and 5 say the premise of D-CF4-05 is "false since 2.1.198", with high confidence. The note at line 607 says D-CF4-05 rests on a probe at 2.1.316, a later version than 2.1.198, and asks whether that probe ran under `claude -p`. So a live observation contradicts the changelog reading, this analysis ran nothing live, and the document does not say which wins or name a spike for it. S2 covers a different question.
- **Rationale & Recommendation**: Lower the stated confidence or add a spike that settles the conflict.

#### C-07 Whether several acceptance tests can run is unclear - Severity: Major

- **Affected Scope:** HOOK-07a, AGENT-01, AGENT-02, AGENT-03, WF-05
- **Discrepancy Description**: Line 607 says the harness "cannot yet run a full background child". HOOK-07a (P0) nonetheless specifies a scenario "in a background child" in `features/plugin/subagent-child.feature`, and AGENT-03 uses "a scripted child". AGENT-02 falls back to pinning text; WF-05 says it needs a live child.
- **Rationale & Recommendation**: The document never says how the existing feature file stands in for a child. State what the harness can and cannot run, and mark each acceptance as achievable today or not.

#### C-08 CORE-06 does not say whether its fix closes the attack it describes - Severity: Major

- **Affected Scope:** Lines 697-705, and the trust row in section 8
- **Discrepancy Description**: "Today" describes a repository that commits `.pi/pi-claude-marketplace/state.json`. The note and section 8 then say Pi asks for trust only for its own protected paths, so `ctx.isProjectTrusted()` is true for a repository that carries only this extension's files. Read together, the requirement would change nothing in that case. "The practical reach is low" does not say whether that means the vulnerability or the fix.
- **Rationale & Recommendation**: This is a P0. Say plainly which cases the fix closes and which it does not.

#### C-09 Unspecified enumerations inside requirement text - Severity: Major

- **Affected Scope:** CORE-03, HOOK-04, sections 7.2 and 7.6, WF-05
- **Discrepancy Description**: "the five MCP fields" (line 715) is the one a requirement depends on; an implementer cannot act on it. Also never listed: "the three tool events" and "the two post events" (lines 360-363), "the three path variables" (line 683), "the four Claude fields" for OAuth (line 438), the "seven tool names" the agents bridge maps (line 561), and the 10 admitted hook events (line 301).
- **Rationale & Recommendation**: List the members of each set where it is first used.

#### C-10 Section 10's handling instruction cannot be followed - Severity: Major

- **Affected Scope:** Line 842
- **Discrepancy Description**: It says to fix "the ones with no requirement (the last five rows, and the proof paths)" in one task. Four of the last five rows cite a requirement (CORE-07, CORE-03, AGENT-04, AGENT-06); only UAT-02 does not. Rows that cite none are spread through the table: lines 819, 820, 821, 824, 826, 829, 833, 835.
- **Rationale & Recommendation**: Mark each row with its owning requirement or "none", and drop the "last five rows" wording.

#### C-11 Frequency denominators beyond the one section 4 declares - Severity: Major

- **Affected Scope:** Section 4 versus lines 728 and 734
- **Discrepancy Description**: Section 4 says counts come only from a local copy with 17 plugin folders, against a catalog of 317. CORE-02 says "1 of 21 cached plugins" and PI-02 says "0 uses in 76 plugins"; neither set is explained. "The official marketplace" and its "local copy" are never identified, nor how the `anthropics/skills` marketplace relates to it.
- **Rationale & Recommendation**: Name each sample set once, with its size and where it lives.

#### C-12 Companion extensions are used before they are introduced, and "the engine" is never tied to a package - Severity: Major

- **Affected Scope:** Section 2 items 1, 3 and 6; section 7.4
- **Discrepancy Description**: "The workflow engine" appears dozens of times; that it is `@quintinshaw/pi-dynamic-workflows` can only be inferred from the shared 3.15.1 version. pi-subagents is explained at 7.5 and pi-mcp-adapter at 7.3, after section 2 relies on both. Section 7.4 does not say how the engine finds the agent files written for pi-subagents, yet WF-02 and spike S4 depend on that link.
- **Rationale & Recommendation**: Introduce the four companions once, before section 2, and explain the engine-to-agent-file link in 7.4.

#### C-13 Version confusion - Severity: Nit

- **Affected Scope:** Lines 31, 351, 837
- **Discrepancy Description**: `agent_before_settle` is "added in Pi 0.87.0, below the floor", the Pi floor is 1.5.0, and pi-subagents also has a 0.87.0. A reader cannot tell whether "Pi 0.87.0" is right or a slip. The Pi floor is first stated at line 685.

#### C-14 "Upstream" shifts meaning - Severity: Nit

- **Affected Scope:** Lines 504, 614, 741; `.planning/upstream/`
- **Discrepancy Description**: Section 7 defines "upstream" as Claude Code. It means Pi or the extensions' own repositories in "an upstream change would unlock", "fixes drafted for upstream", and "upstream issue or patch".

#### C-15 The path rule at line 221 is not followed - Severity: Nit

- **Affected Scope:** Throughout section 7
- **Discrepancy Description**: These paths are not under `extensions/pi-claude-marketplace/` and are not labeled: `dist/cli/file-processor.js:60` (Pi), `types.ts:968-991` (adapter), `dist/extensions/mcp/*`, `scripts/install-test-peers.mjs`, `package.json`, `README.md`, and marketplace paths such as `asana/commands/asana-setup.md`.

#### C-16 Test-harness vocabulary is undefined - Severity: Nit

- **Affected Scope:** Acceptance lines
- **Discrepancy Description**: "Profile" / "both profiles" / "adapter twin", "the engine companion", "scripted model", "recording hook", "stub server", "fixture plugin".

#### C-17 Several names for one thing - Severity: Nit

- **Affected Scope:** Section 7.1 and others
- **Discrepancy Description**: "Skill-read fill" / "model-read fill" / "a model read of a staged `SKILL.md`"; "the model tool" / "the command tool" / `run_plugin_command`; "official" / "first-party" plugins.

#### C-18 Smaller undefined project or Pi terms - Severity: Nit

- **Affected Scope:** Throughout
- **Discrepancy Description**: Hooks and MCP: "the `if` evaluator" (310), "the hooks view" (457), "plain `async` hook" and "background lane" (384), "host-only types" (421). Pi surfaces: "codemode" and "deferred tools" (824), "print mode" / "RPC mode", "virtual models". Project internals: "reconcile" and "agent grants step" (339), "containment" (683, 729), "phase ownership" (91), "a phase" as size L (223), "the memory of this project" (521), `.pi/claude-plugins.json` (705), and what `strict` does (731).

#### C-19 The zero-width space is explained nowhere - Severity: Nit

- **Affected Scope:** Section 8, first Pi row (line 747)

#### C-20 Line 855 says "Two" and lists three - Severity: Nit

- **Affected Scope:** Line 855
- **Discrepancy Description**: It says "Two P0 requirements replace an existing scenario" and lists three artifacts, one of which is a file header and not a scenario.

#### C-21 Milestones 2 and 4 omit their prerequisites - Severity: Nit

- **Affected Scope:** Section 11
- **Discrepancy Description**: Milestone 1 lists its prerequisite decisions and spikes. Milestones 2 and 4 do not: HOOK-04 needs decision 9, HOOK-11 needs S7, CORE-03 needs 17, CORE-05 needs 10, CMD-09 needs 13, MCP-06 needs 5, SKILL-01 needs S8.

#### C-22 Sections 6 and 7 disagree in small ways - Severity: Nit

- **Affected Scope:** HOOK-14, AGENT-01, SKILL-01, SKILL-06
- **Discrepancy Description**: HOOK-14 is "S" in section 6 and "S each" in 7.2. AGENT-01, SKILL-01 and SKILL-06 show a spike in section 6 that their section 7 entries do not mention.

#### C-23 The confidence scale is not kept - Severity: Nit

- **Affected Scope:** Section 4 versus the entries
- **Discrepancy Description**: Section 4 defines High, Medium and Low. Entries use "medium-high", "low to medium", "high (not run)", "High on upstream" and "Varies". HOOK-13 is "high" while its note says the tool-call reset was not confirmed in the binary.

#### C-24 The corrected report errors may still be in the linked reports - Severity: Nit

- **Affected Scope:** Line 75
- **Discrepancy Description**: The review found two errors "in the reports" and corrected them here. The document does not say whether the linked reports were fixed, so a reader who follows the links may meet the uncorrected claim. SKILL-06 carries no "corrected" marker, where HOOK-16 does.

#### C-25 Section 5 rows differ in form - Severity: Nit

- **Affected Scope:** Section 5
- **Discrepancy Description**: Some rows pose a question (7, 21); others only state a finding (4, 18, 19, 22), which leaves the choice to infer.

#### C-26 MCP-01 leaves one variable and one figure unconnected - Severity: Nit

- **Affected Scope:** MCP-01; line 825
- **Discrepancy Description**: "Today" says `MCP_TOOL_TIMEOUT` is not read; the requirement reads only `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and does not say what happens to the other. The "about 28 hours" figure at line 825 is not connected to anything in MCP-01.
