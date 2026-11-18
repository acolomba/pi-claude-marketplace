# Goldfish Review Report: Stage 7 (Critic Review)

**Target:** `docs/prd/parity-gaps-prd.md` (FeatureRange lines 1-855)

**Standard:** `feature-spec-standard` for `egm-design` and `egm-structural`; no standard for `egm-style`.

## Reviewer Status

| Reviewer         | Status    |
| ---------------- | --------- |
| `egm-design`     | completed |
| `egm-structural` | completed |
| `egm-style`      | completed |

Verdict from both standard-bound reviewers: the document does not pass the feature-spec standard as written. 1 Blocker, 21 Major, 20 Nit after deduplication. The orchestrator checked finding K-08 in the hooks report and confirms it.

## Prioritized Findings (Blockers -> Major -> Nits)

### K-01 No evaluation of alternatives - Severity: Blocker

- **Reviewer Lens:** `egm-design`, `egm-structural` (both raised it)
- **Affected Scope:** Whole document
- **Discrepancy Description**: The standard's Alternatives Rule is unconditional: a specification "must include a mandatory evaluation of alternatives" and fails without it. The document has no such section, and almost every requirement proposes one path. Alternative material is scattered and never framed as considered and rejected: the "Why not now" column of the P3 table, either/or options left open inside MCP-02, WF-06, HOOK-01 and decision 20, one rejected target in prose (pi-subagents as a workflow target, line 519), and the out-of-scope list.
- **Rationale & Recommendation**: The high-impact items need this most. AGENT-01: keep the foreground and ask pi-subagents to load extensions in foreground children, or add a setting; the first option is not in the section 8 request table although line 679 lists the limitation. HOOK-01: send both Pi and Claude field names, versus translate. CORE-06: a consent record kept by the extension, versus Pi's trust flag. MCP-01: 1800 seconds versus a smaller default. Add an "Alternatives" line to each P0 and P1 requirement, or one section that covers them, with a concrete rejection reason for each. Note from the structural reviewer: the document is a gap catalogue, not a single-feature specification, so either form satisfies the rule.

### K-02 Risks and mitigations are not systematic - Severity: Major

- **Reviewer Lens:** `egm-design`, `egm-structural`
- **Affected Scope:** Section 7 template (line 221); no risk section
- **Discrepancy Description**: The requirement template has no risk field. Risk statements in the research were dropped when the requirements were written: MCP-01 "a hung stdio server now blocks a call for 30 minutes instead of 1"; AGENT-01 headless `pi -p` behaves differently; WF-01 confidence is only medium that the model does not recover; AGENT-05 it is unknown how Claude Code parses the unquoted-colon case. Security risks sit in Notes with no paired mitigation: CORE-06, the S4 question, decision 20, the MCP-04 credential difference, slow regular expressions. There is no treatment of installs that already exist: CORE-01 (skills disappear on update), AGENT-05 (file rename), CORE-02 and WF-06 (renames), AGENT-01 (staged `async: false` files), MCP-01 and MCP-06 (values written at stage time). The word "migration" appears once.
- **Rationale & Recommendation**: Add a risk and mitigation line to each requirement, and one section on how existing installs converge.

### K-03 CORE-06 does not close the threat it describes - Severity: Major

- **Reviewer Lens:** `egm-design`, `egm-style`
- **Affected Scope:** Lines 32, 697-705, 753
- **Discrepancy Description**: The stated attack is a repository that commits `.pi/pi-claude-marketplace/state.json`. Pi asks for trust only for a fixed list of paths, and this extension's files are not on it, so `ctx.isProjectTrusted()` is true there. The proposed gate changes nothing for that repository. The same mechanism covers project-scope hooks, a larger exposure than an appended `PATH` entry. The real hole is in section 8 as a request to Pi, with no ID, no priority, and no in-project mitigation considered. The document also drops the report's open question on whether project-scope MCP registrations have the same hole. "The practical reach is low" does not say whether it means the exposure or the fix.
- **Rationale & Recommendation**: State what CORE-06 does and does not close. Give the trust-prompt gap an ID and a priority. Evaluate a consent record kept by the extension at user scope.

### K-04 Security items and decisions have no ID, so planning will lose them - Severity: Major

- **Reviewer Lens:** `egm-design`, `egm-structural`, `egm-style`
- **Affected Scope:** Sections 5, 6, 7.3, 7.4
- **Discrepancy Description**: Spike S4 (a read-only plugin agent may hold `bash`, `edit` and `write` inside a workflow) and decision 20 (plugin servers get sampling and UI windows under the adapter) are trust gaps under the document's own P0 definition. Neither has an ID, priority, or milestone. Decisions 7, 14 and 20 point to bold paragraphs, not requirements or headings. Section 5 says each row must be answered first, but more decisions exist only in section 7 prose: whether a regular-expression group reports as supported (HOOK-03); `permission_mode` (HOOK-04); the credential difference (MCP-04); where project-scope `userConfig` values are stored and required options (CORE-03); the three "does more than upstream" lists (lines 407-411, 665, 737); dot-file scripts (line 575); the SKILL-08 decision. The paragraph at line 575 is labeled "decision 14 and others" and mixes decision 14, decision 16, and an unnumbered item. Most section 5 rows state a finding and no question.
- **Rationale & Recommendation**: Give each item an ID. List every decision in section 5 with a "Question" column. Narrow "first" to the decisions that gate P0 and P1.

### K-05 AGENT-01 is treated as a small P0 defect, but it is a behavior change for every agent - Severity: Major

- **Reviewer Lens:** `egm-design`, `egm-style`
- **Affected Scope:** Lines 26, 84, 598-607, 832, 848
- **Discrepancy Description**: The requirement reverses a decision that rested on a live probe (2.1.316), on the strength of documentation and a changelog line. The premise is called "false" four times without qualification, while the Notes ask whether the probe ran under `claude -p`. No spike re-runs it. With a background child the parent receives an acknowledgement, not the reply; the effect on plugin commands that delegate and then use the result is not analyzed. No opt-out is proposed. The harness cannot run a full background child (BACKLOG AGTASYNC-01), so AGENT-01 and AGENT-02 have no end-to-end automated proof, and the harness work is not a requirement and not sized. Design reviewer's inference: each background child registers MCP for its own session, so with MCP-06 there would be one set of stdio server processes per child, including stateful ones.
- **Rationale & Recommendation**: Move the open probe question to row 1 of section 5. Replace "false" with "contradicted by the documentation and the 2.1.198 CHANGELOG; the earlier probe is unexplained". Add a Claude Code probe spike, make AGTASYNC-01 a requirement of the same milestone, add the resource question to S2, and specify an opt-out.

### K-06 WF-01 is necessary but not shown to be sufficient for the top finding - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 24, 525-534, 579-590, 789
- **Discrepancy Description**: The engine's tool text says to call `workflow` only when the user explicitly opts in, and the research notes that a model may decline a plugin command's instruction. The acceptance uses a scripted model, which always calls. Other gaps the document calls not closable affect the same official scripts: `parallel()` rejects where 6 of 7 scripts expect `null`, and slash arguments are parsed differently. The document never states what the two official workflow plugins will do end to end after WF-01. Scope is inconsistent: section 6 says "inside `Workflow({ name })`"; line 532 removes the slash from every reference without one, including prose that told the user what to type. WF-01 widens exposure to the S4 question, yet S4 is scheduled two milestones later.
- **Rationale & Recommendation**: State the end-to-end outcome. Tie WF-01 to the gate-text request. Run S4 before or with WF-01.

### K-07 HOOK-01 commits to "first `edits` pair only" while calling it open - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 310-312
- **Discrepancy Description**: The requirement text says the first pair becomes `old_string` and `new_string`. The notes list the same point as an open question. With first-pair-only, a content-scanning hook never sees later pairs of a multi-pair call and reports nothing. The reverse translation of `updatedInput` for a multi-pair edit is undefined. No reason is given for the `if` evaluator reading the untranslated event.
- **Rationale & Recommendation**: Resolve before planning. One hook run per pair, with any block winning, is the conservative choice.

### K-08 HOOK-03 states the Claude Code matcher rule wrongly - Severity: Major

- **Reviewer Lens:** `egm-design` (confirmed by the orchestrator in `docs/research/parity-gaps/hooks.md`, row U9)
- **Affected Scope:** Line 318
- **Discrepancy Description**: The document says an exact list has only letters, digits, `_`, `-`, `|` and `,`. The research gives the binary rule as `/^[a-zA-Z0-9_|, -]+$/`, which includes the space. Under the document's wording, `Edit, Write` is a regular expression and would not match `Write`, which contradicts the requirement's own acceptance line. This is a transcription error made in the PRD, in a P0 requirement.
- **Rationale & Recommendation**: Correct line 318 to include the space.

### K-09 The evidence error rate is not carried into the commitments - Severity: Major

- **Reviewer Lens:** `egm-design`, `egm-style`
- **Affected Scope:** Lines 20-33, 71-76
- **Discrepancy Description**: The second review re-checked about 20 claims and found two errors. The design reviewer found a third (K-08) by checking one more. About 60 requirements were not re-checked, and no live session ran. Thirteen items are still labeled P0, several with medium confidence. The summary states run-time behavior as observed fact ("do nothing on file tools and report no error"; "do not work" in a foreground child, where line 596 says the hook half was not run; "rejects a name with a slash", where line 534 says a full install was not run). The limit "no live session was run" sits only in section 4.
- **Rationale & Recommendation**: Re-check every P0 and P1 against its report before planning, and say so in section 4. Put one sentence at the top of section 2 saying the findings come from source reading, not from observed runs.

### K-10 SKILL-01 attaches files after substitution, which creates an injection path - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 236-238
- **Discrepancy Description**: `@path` tokens are resolved after argument substitution and `!` injection. A token that arrives through `$ARGUMENTS` (including from the model through `run_plugin_command`) or through command output gets a local file attached to the prompt. That read does not pass through `PreToolUse` hooks on `Read`. The size limit is unspecified, and symbolic links are not addressed. Claude Code's own ordering is unknown.
- **Rationale & Recommendation**: Recognize tokens in the author's static text only, then fill variables inside them. Specify the limit. Add the ordering question to S8.

### K-11 Sequencing gaps in section 11 - Severity: Major

- **Reviewer Lens:** `egm-design`, `egm-structural`, `egm-style`
- **Affected Scope:** Lines 844-853
- **Discrepancy Description**: AGENT-02 (milestone 1) raises the pi-subagents floor to 0.87.0. Line 647 says that from 0.87.0 an `anthropic/...` ID always runs on that provider and fails for Copilot, Bedrock and OpenRouter users. The fix, AGENT-07 (b), is in milestone 3. Milestones 2 and 4 omit prerequisites their items need: decisions 9, 5, 10, 13 and 17, and spikes S7 and S8. CORE-03 step 1 is said to stand alone, but it stops counting `userConfig` as unsupported; a plugin with a required option and no default would install cleanly and fail at run time with a literal `${user_config.KEY}`. `configure <plugin> KEY=VALUE` puts a secret on a typed command line; whether it lands in session history is not addressed.
- **Rationale & Recommendation**: Land AGENT-07 (b) with AGENT-02. List prerequisites for every milestone. Ship CORE-03 steps 1 and 2 together, or keep such a plugin partially available.

### K-12 MCP-02 couples the project to a private algorithm and can fail open - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** Lines 452-461
- **Discrepancy Description**: The project would recompute the adapter's hash from `types.ts:968-991`, which is not a public contract. A later adapter patch could change it without notice. The worst case is `excludeTools`: a name mismatch leaves a disallowed tool available. The acceptance covers listing and hooks, not `excludeTools`. "Accept both forms" needs run-time version detection, which is not described.
- **Rationale & Recommendation**: Add a contract test against the installed adapter and an `excludeTools` scenario. Consider asking the adapter to export the function.

### K-13 Cost and resource effects are not quantified - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** AGENT-01, AGENT-03, AGENT-08, HOOK-02, MCP-01, HOOK-21
- **Discrepancy Description**: AGENT-01: parallel child processes with no concurrency limit stated. AGENT-03: 12 of 40 agents gain nested delegation. AGENT-08: every bridged agent's prompt grows by the global context file. HOOK-02: a continuation may cost one provider request. MCP-01: a 30-minute blocking window. HOOK-21: async hooks with no timer can accumulate.
- **Rationale & Recommendation**: Add a short limits section with a ceiling or a stated acceptance for each.

### K-14 No "Proposed Architecture" section, and no stated reason for its absence - Severity: Major

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Section 7
- **Discrepancy Description**: The standard lists component layout, data flows, and ecosystem integration. The target states behavior per requirement and gives no component or data-flow view. The nearest substitute is a "Touch:" label in three requirements.
- **Rationale & Recommendation**: Add the section, or state that architecture is deferred to design because the document is input for planning.

### K-15 The section 6 index and the section 7 body do not hold the same set of requirements - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`, `egm-design`
- **Affected Scope:** Lines 118-217 versus 225-737; line 20
- **Discrepancy Description**: In section 7 but absent from section 6: CMDSKILLMD-01, SKILLCLASH-01, CMDINFO-01, MCP-11, PI-03. In section 6 with no entry in section 7: SKILL-12. DOC-01 has no heading and no table row. WF-05 appears twice, once with an empty "Today" cell. Section 2 says 76 closable gaps; section 6 has 81 rows, and no merge of paired IDs gives 76.
- **Rationale & Recommendation**: State the counting unit, make section 6 complete, and reconcile the number.

### K-16 The declared requirement template is not followed - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`
- **Affected Scope:** Section 7; lines 11, 221, 855
- **Discrepancy Description**: Lines 11, 221 and 855 say every requirement has Upstream, Today, Enabler, Requirement, and Acceptance. Table-form requirements (about 40 to 50 rows) have no Acceptance. Three lower-priority tables also drop Upstream and Today. MCP-08 has no Upstream, Enabler, or Acceptance. Enabler is "None needed" in three entries and missing in ten. "Notes" is in almost every requirement but not in the declared form. The seven requirement tables use six column sets. Line 76 says confidence is stated for each requirement; three tables have no Confidence column.
- **Rationale & Recommendation**: Narrow lines 11, 221 and 855 to "each P0 and each long-form P1 requirement", or add the fields. Use one column set.

### K-17 Recorded decisions and maintainer statements are cited without a location - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`, `egm-design`
- **Affected Scope:** Section 5; lines 95, 99, 217, 221
- **Discrepancy Description**: The standard says a rejection must not be attributed to a maintainer without a link. Line 95 ("The maintainer re-affirmed the decision the same day") and line 99 ("The maintainer already chose ... on 2026-11-02") have no link or record ID. None of the 22 rows locates its record. The IDs live in three places (`.planning/PROJECT.md`, `.planning/BACKLOG.md`, `docs/prd/pi-claude-marketplace-prd.md`), and the document never says which. Two normative rules are stated without a source: "A divergence from Claude Code is legitimate only when ..." (line 80) and "a plugin cannot give itself an adapter power ..." (line 103).
- **Rationale & Recommendation**: State once where each ID family is recorded. Cite a record for each maintainer statement and each rule.

### K-18 Two statements about the document's own structure are false - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`
- **Affected Scope:** Lines 60 and 842
- **Discrepancy Description**: Line 60 says "The requirement IDs in this document are the IDs in those reports." DOC-01, HOOK-07a and HOOK-07b are in no report. MCP-07, SKILL-02, CMD-02 and PI-03 are folded into other IDs, mentioned only in passing. Line 842 says the corrections with no requirement are "the last five rows, and the proof paths". Four of the last five rows cite a requirement; the rows that cite none are spread through the table.
- **Rationale & Recommendation**: Add an ID alias table. Replace the positional reference in section 10 with a Requirement column.

### K-19 The section 2 framing claims more than its ten items support - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 22-33
- **Discrepancy Description**: "These are the findings that matter most" conflicts with the document's own priorities: the list has two P1 items (HOOK-02, CORE-03) and omits four P0 items (HOOK-13, HOOK-07a, AGENT-05, SKILL-04). "Each is a defect that affects plugins in the official marketplace today, or a recorded decision that rests on a premise that is no longer true" does not cover CORE-06 or HOOK-02.
- **Rationale & Recommendation**: State the selection rule that was used.

### K-20 The confidence and priority scales as defined are not the scales as used - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 76, 111-114, and the per-requirement lines
- **Discrepancy Description**: Line 76 defines High, Medium, Low. The document uses "medium-high", "low to medium", "Varies", and scoped forms such as "High on the facts". Several confidence cells also carry usage counts. "(not run)" appears on some lines only; line 622 says "both sides were run" in a document that says nothing was run live. P2 is defined as "needs a decision or a spike before it is real", yet 13 P0 and P1 rows carry a decision or a spike; WF-05 is P1 with low-to-medium confidence and a spike. "Priority P0 with AGENT-01" does not say whether the priority is conditional.
- **Rationale & Recommendation**: Use the defined values only. Separate usage from confidence. Make the P1 and P2 boundary exclusive.

### K-21 Claims that go further than the evidence stated in the document - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-design`
- **Affected Scope:** Lines 9, 28, 417, 433, 484, 508, 519, 626, 685, 719, 737, 741, 793, 835
- **Discrepancy Description**: Line 28: "Every plugin MCP tool call fails after 60 seconds of silence" holds only with no declared timeout and no progress. MCP-08's title says resources, prompts and elicitation "work"; the same block says not run, and prompts appear under a wrong name. Line 433 states the wrong prompt name as fact; line 508 says "probably". Line 737 says Claude Code adds `bin` only for the shell tool and that the docs column "is wrong"; line 835 says this is inferred from one call site, and S8 still asks. "This is harmless" (line 737) follows CORE-06, which treats the same `PATH` as a trust matter. Line 685 says every capability exists at the Pi 1.5.0 floor; line 657 says `claude-fable-5-2` needs Pi 1.5.1. "Common in third-party MCP plugins" and "common in plugin agents" have no count. Line 9 says "lists every gap". Line 741 calls the section 8 requests "small", and line 793 calls each spike "small"; the rows include items the document elsewhere calls "not small", and S8 bundles six probes. Line 554 says "a two-line engine patch"; line 781 says "a few lines".
- **Rationale & Recommendation**: Reduce each claim to what the evidence supports, or state the evidence.

### K-22 Terms and references a new reader cannot resolve - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-design`
- **Affected Scope:** Throughout
- **Discrepancy Description**: "Upstream" is defined as Claude Code (line 221) and also used for Pi and the extensions (lines 504, 614, 741). Undefined terms: "the memory of this project", "codemode", "settled autonomously", "house rule", "partial" and "the partial model", "the hooks view", "the scripted model", `--map-model`. Synonyms: "implementation" and "profile"; "the `run_plugin_command` tool", "the command tool", "the model tool"; "skill-read fill" and "model-read fill". The path rule on line 221 is broken by repository-root paths and by paths inside other packages. Denominators 76 and 21 (lines 734, 728) are not defined. "14 `.mcp.json` files" (line 74) versus "14 local servers" (lines 472, 515).
- **Rationale & Recommendation**: Keep "upstream" for Claude Code. Define each term once. Use one name per thing. Name the package for every path outside the extension.

### K-23 Nits from the design lens - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** HOOK-07a, MCP-01, AGENT-03, AGENT-05, HOOK-22, section 1
- **Discrepancy Description**: HOOK-07a: Claude Code sends `agent_id` and `agent_type`; the requirement adds only `agent_type`. MCP-01: `MCP_TOOL_TIMEOUT` is named under Upstream and not in the requirement; the research reads the idle variable only on the built-in path; the 65-second acceptance conflicts with MCP-06's "a timing scenario is too slow". AGENT-03: mapping `Agent(x, y)` to an unrestricted `subagent` reads as widening a grant; the document should say that Claude Code ignores the type list inside a subagent. AGENT-05: 0 local agents have a quoted name, model, or effort; the observed effect is quote marks in 4 descriptions, which is thin for P0. HOOK-22 is titled "at session start", but its event fires on every run. No measurable success criterion is stated, such as a named set of official plugins that must work end to end.

### K-24 Nits from the structural lens - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Headings, tables, formatting
- **Discrepancy Description**: Problem statement and goals are not labeled as such. H3s are numbered under section 7 and unnumbered under sections 6 and 8. "Lower-priority requirements" and "Smaller requirements" are each used three times as headings, which gives ambiguous anchors; the label is wrong at line 492, where MCP-09 is P1. Bold run-in paragraphs act as headings ("State of parity.", "Not closable today.", "Divergence...") and are not in the heading tree. In 7.1, SKILL-01 (P1) precedes SKILL-04 (P0). The priority line varies in form. H4 titles mix defect style and action style. HOOK-14 is "S" at line 144 and "S each" at line 383. Empty cells use "--" in some tables and a blank in another. Line 3 puts four bold labels on one line. The second table in 7.3 has no lead-in sentence and is referred to by position.

### K-25 Nits from the style lens - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Lines 15, 20, 47, 75, 114, 215, 223, 227, 322, 351, 354, 394, 399, 402, 417, 640, 647, 679, 683, 695, 731, 811, 844-855
- **Discrepancy Description**: Line 75 repeats ten IDs already covered by "the ten findings in section 2" and omits CORE-03. Line 855 says "Two" and lists three. Two separate "about 70" figures stand beside an exact 76. Line 227: "in better shape than the project's own records say" and "at the edges" are vague, and the section contains a P0. Line 15: "Much of the current code was written against older versions" is unquantified. Colloquial phrasing: "Recorded so that nobody finds it again", "Pure engineering ... Do last, if ever", "mostly moot", "runs on whatever the session gives", "parity for its own sake", "Pi cannot fill honestly", "must be clean". "Low value" and "Rare" have no stated basis. Four caveats name no reader decision (lines 322, 354, 399, 640). The non-commitment is stated three times (lines 3, 844, 846). Line 351: "added in Pi 0.87.0, below the floor" can be read as "not available at the floor". Line 417: "`docs/mcp.md` is byte-identical" does not say it is Pi's file. Line 223: "L is a phase" is not a time unit. Notes paragraphs pack rationale, open questions, usage, and files into one block under undefined labels "Open:", "Use:", "Touch:".

## What passed

- Heading hierarchy, table syntax, links, section cross-references, and the Spike column against section 9 are all consistent.
- Section 11 covers all 29 P1 rows of section 6.
- Three code citations the design reviewer checked are accurate: `domain/skill-tokens.ts:113-115`, `bridges/hooks/runtime.ts:275-277`, `orchestrators/plugin-path.ts:87-106`.
- The prose is direct and has no promotional language.
