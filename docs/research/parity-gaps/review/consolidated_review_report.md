# Consolidated Review Report

**Target:** `docs/prd/parity-gaps-prd.md` (855 lines), reviewed on 2026-11-11 as a feature specification. The document has no implementation plan section, so FeatureRange is lines 1-855 and DetailedRange does not apply.

**Context given to reviewers:** the six evidence reports under `docs/research/parity-gaps/`, which the target links to. The comprehension stage read the target alone.

## Verdict

The document does not pass the feature-spec standard as written. One Blocker: it has no evaluation of alternatives. Beyond that, the reviewers found one factual error in a P0 requirement, one P0 requirement whose fix does not close the threat it describes, a possible privilege gap that has no ID or priority, and a P0 "false premise" claim that rests on weaker evidence than the decision it overturns. The rest is about scope, internal consistency, and context a new reader lacks.

The last stage weighed the changes that the earlier stages ask for. Its conclusion: most of the requested new sections and fields would bloat the document, and about 14 small edits make it fit for milestone planning.

## Stage Status

| Stage                      | Reviewers                                   | Status    | Findings                           | Report                                                  |
| -------------------------- | ------------------------------------------- | --------- | ---------------------------------- | ------------------------------------------------------- |
| 5 Initial Zoom Out         | `egm-zoom-out`, `egm-inventive-catalyst`    | completed | 0 Blocker, 12 Major, 7 Nit         | `zoom_out_report.md`                                    |
| 6 Comprehension Test       | `egm-comprehension`                         | completed | 0 Blocker, 12 Major, 14 Nit        | `comprehension_report.md`                               |
| 7 Critic Review            | `egm-design`, `egm-structural`, `egm-style` | completed | 1 Blocker, 21 Major, 20 Nit groups | `critic_report.md`                                      |
| 8 Intermediate Zoom Out    | `egm-zoom-out`                              | completed | 0 Blocker, 10 Major, 5 Nit         | `intermediate_zoom_out_report.md`                       |
| 9 Implementation Readiness | --                                          | not run   | --                                 | Not applicable: the document has no implementation plan |

No reviewer failed or timed out. The document was not edited between stages.

## Action Items

Finding IDs: Z = stage 5, C = stage 6, K = stage 7, ZI = stage 8.

### 🔴 Blocker

**A-01 Add an evaluation of alternatives.** The feature-spec standard fails a document without one. Stage 8 narrows the remedy: one table of about eight rows, only where a real fork exists (AGENT-01, HOOK-01, HOOK-02, CORE-06, MCP-01, MCP-02, WF-03, AGENT-05). Each alternative gets one line and a status: "rejected, because ..." or "open, see decision n". Do not add an Alternatives field to every requirement. Sources: K-01, ZI-02.

### 🟡 Major

**A-02 Correct the hook matcher rule in HOOK-03 (line 318).** The PRD says an exact-list matcher has only letters, digits, `_`, `-`, `|`, and `,`. The hooks report, row U9, gives the Claude Code rule with the space included. Under the PRD's wording, `Edit, Write` would be a regular expression, which contradicts the requirement's own acceptance line. This error was made when the PRD was written, in a P0 requirement, and the orchestrator confirmed it. Then check the other 12 P0 entries against their reports for the same kind of slip. Sources: K-08, K-09, ZI-10.

**A-03 State what CORE-06 closes, and lower its priority.** Pi asks for trust only for a fixed list of paths, and this extension's files are not on it. So the trust call returns true for a repository that commits `.pi/pi-claude-marketplace/state.json`, which is the attack the requirement describes. The proposed gate changes nothing in that case. The same cause weakens the existing trust gates on hooks, skills, and commands; D-LOC-01 records it as accepted. Say plainly which case the fix closes. Move CORE-06 out of P0 and out of the section 2 list. Give the trust-prompt gap an ID and a decision row ("D-LOC-01 accepted gap: confirm or reopen"). List a consent record kept by the extension as an alternative with its costs, not as a requirement. Sources: Z-01, C-08, K-03, ZI-08.

**A-04 Give the workflow tool-list question an ID, and run its spike first.** If spike S4 confirms the inference, a plugin agent that Claude Code restricts to read-only tools holds `bash`, `edit`, and `write` when a workflow uses it as an `agentType`. Seven of seven official scripts use `agentType`. The item has no ID, no priority, and no milestone, while WF-02 adds a scenario that proves the binding. The exposure exists today through the typed workflow command, so the spike does not depend on WF-01. Move S4 to the first milestone and state the fallback if the engine is not patched. Sources: Z-02, K-04, K-06, ZI-09.

**A-05 Reword AGENT-01 and settle its premise before calling it a P0.** The PRD calls the premise of D-CF4-05 "false" four times. D-CF4-05 rests on a live probe at 2.1.316; the PRD rests on documentation and a changelog line, and its own note asks whether the probe ran under `claude -p`. Replace "false" with "contradicted by the documentation and the 2.1.198 CHANGELOG; the earlier probe is unexplained". Add a spike that re-runs the probe interactively, and put that question in decision row 1. State the remaining gain precisely: the code already forces the background for agents with plugin MCP tools, so what is left is launch-mode parity and tool hooks inside children. Size AGENT-01, HOOK-07a, and spike S2 as one item. Name the pi-subagents setting `asyncByDefault` as the opt-out. Say what a background acknowledgement does to a plugin command that delegates and then uses the result. Sources: Z-04, C-06, K-05, ZI-04.

**A-06 Remove the "first pair only" rule from HOOK-01.** The requirement fixes the first-pair rule while its notes call the same point open. With that rule, a content-checking hook never sees pairs 2 to n of a multi-pair edit, so the fix leaves the silent bypass it is meant to close. State the behavior instead: no pair of a multi-pair edit escapes a matching hook. Leave the mechanism (one run per pair, or another form) to design, and record the open points: reverse translation of `updatedInput`, and the matching choice for `PostToolUse`. Sources: Z-06, K-07.

**A-07 Apply the priority definitions as written.** P1 is "a parity gain with evidence of use", yet several P1 rows state zero use or give no figure (SKILL-03, CORE-04, MCP-08, MCP-09, HOOK-21, HOOK-23). About half of the P2 rows say "0 uses", and section 11 sends all of P2 to the backlog. P2 is "needs a decision or a spike", yet 13 P0 and P1 rows carry one. Re-tier: zero-use items go to P3 until use is shown. Make the P1 and P2 boundary exclusive. A wider count over the 317 catalog entries is cheaper than building on a guess. A named set of official plugins that must work end to end would serve as the tiering test and as the selection rule for section 2. Sources: Z-03, K-19, K-20, ZI-01, ZI-11.

**A-08 Reconcile the requirement list, the count, and three statements about the document.** Section 2 says 76 closable gaps; section 6 has 81 rows, and no merge of paired IDs gives 76. Section 7 has items missing from section 6 (CMDSKILLMD-01, SKILLCLASH-01, CMDINFO-01, MCP-11, PI-03); section 6 has SKILL-12 with no entry in section 7; DOC-01 has no row; WF-05 appears twice. Line 60 says the IDs are the report IDs, which is not true for DOC-01, HOOK-07a, HOOK-07b, and four folded IDs. Line 842 points at "the last five rows", four of which do cite a requirement. Line 855 says "Two" and lists three. State the counting rule and fix each. Sources: Z-17, C-03, C-10, C-20, K-15, K-18.

**A-09 Complete the decision list, and separate what gates the first work.** Section 5 says every row comes first; section 11 says only five do. At least nine more decisions exist only in section 7 prose: the three hook divergences, the `thinking` field, `bin` on `PATH`, dot-file scripts, `permission_mode`, the MCP-04 credential difference, the regular-expression reporting question, the built-in agent mapping, and the SKILL-08 decision. Decisions 7, 14, and 20 point at paragraphs, not requirements. Split section 5 into "gates P0 and P1" and "can wait". Fold the small "record or remove" items into one row. End each row with its question. Sources: Z-14, Z-15, C-04, C-25, K-04, ZI-12.

**A-10 Fix the sequencing in section 11.** AGENT-02 raises the pi-subagents floor to 0.87.0 in the first milestone. From 0.87.0 a model ID with the `anthropic/` prefix always runs on that provider, which fails for users on other providers; the fix, AGENT-07 (b), is two milestones later. Land them together. List the prerequisite decisions and spikes for milestones 2 and 4, which the PRD omits. Sources: C-21, K-11, ZI-05.

**A-11 Calibrate claims to the evidence.** Section 2 states run-time behavior as observed fact, while the "no live session ran" limit sits only in section 4; add one sentence at the top of section 2. "Every plugin MCP tool call fails after 60 seconds" holds only with no declared timeout and no progress. MCP-08's title says features "work" that were not run. The wrong prompt name is stated as fact in one place and as "probably" in another. The claim that Claude Code adds `bin` only for the shell tool is inferred from one call site, yet the PRD calls the project's documentation "wrong" and the divergence "harmless". Line 685 says every capability exists at the 1.5.0 floor; line 657 names one that needs 1.5.1. "Common" appears twice with no count. Sections 8 and 9 call their rows "small" without a basis. Use only the three defined confidence values. Sources: K-09, K-19, K-20, K-21, C-23.

**A-12 Give a new reader the context in section 1.** The document never describes the baseline system. Terms used as known include "bridge", "stage", "partial", "install note", and "profile". Record IDs appear with no location; they live in `.planning/PROJECT.md`, `.planning/BACKLOG.md`, and the main PRD. The four companion extensions are used before they are introduced, and "the engine" is never tied to its package. "Upstream" means Claude Code by definition and Pi or the extensions in four places. Two maintainer statements and two project rules are cited without a record. Add about eight lines: links to the existing glossary and the architecture file, the three record locations, one line per companion, and definitions for the terms the glossary lacks. Keep "upstream" for Claude Code. Do not write a new glossary. Sources: C-01, C-02, C-12, C-14, K-17, K-22, ZI-07.

**A-13 Declare two requirement forms and keep them.** Lines 11, 221, and 855 promise five fields on every requirement. About half the requirements are table rows with no Acceptance; three tables drop Upstream and Today; Enabler is omitted in ten entries and "None needed" in three; the seven tables use six column sets. Declare a full form for P0 and long-form P1 and a one-line form for the rest. Add Acceptance only to the P1 rows that survive A-07. Sources: C-05, K-16, ZI-01.

**A-14 State behavior in requirements, and name existing code where reuse applies.** Many "Requirement" bullets name functions, modules, and internals, against the document's own definition; the planning agents will read them as decisions. Two requirements show the cost. AGENT-05 keeps today's line parser as a permanent fallback, while the skills bridge already repairs the same failure (`repairSingleLineScalars` in `bridges/skills/frontmatter-degrade.ts`); the fallback would also keep the quoting bugs in exactly the files most likely to have them. WF-03 proposes a script reader without naming the existing one in `domain/workflow-script.ts`, and ranks a local workaround above a two-line engine patch. Six requirements extend two separate Claude-to-Pi tool tables that already disagree; say which table each means. Move "Touch" lists to the reports or label them non-binding. Sources: Z-05, Z-08, Z-09, Z-11.

**A-15 Add the missing question to spike S1.** The Pi event is quoted as able to "request one continuation". HOOK-02 needs two continuations in a run and HOOK-13 needs eight. If Pi grants one per run, HOOK-02 cannot carry the `Stop` loop. Ask whether the boundary fires again after a continuation, and state the fallback. Source: Z-07.

**A-16 Restore the dropped risk sentences, in place.** The reports hold risk statements that the PRD dropped: a hung stdio server blocks a call for 30 minutes under MCP-01; headless runs differ under AGENT-01; a model may not recover under WF-01; Claude Code's parsing of the unquoted-colon case is unknown under AGENT-05. Put each back in its requirement. Add one sentence on how existing installs converge (`update` or `reinstall`), and flag the seven requirements that rename or remove artifacts. Do not add a risk section, a limits section, an architecture section, or a migration section; say in one sentence that architecture is deferred to design. Sources: K-02, K-13, K-14, ZI-03.

**A-17 Close two behavior holes in P1 requirements.** SKILL-01 resolves `@path` after argument substitution and `!` injection, so a path that arrives from the model or from command output gets a local file attached without passing a `Read` hook. State that such a path is not attached. CORE-03 step 1 stops counting `userConfig` as unsupported; a plugin with a required option and no default would install cleanly and fail at run time. State that such a plugin stays partially available. Sources: K-10, K-11, ZI-05, ZI-06.

**A-18 Tighten MCP-02.** Recomputing the adapter's hash couples the project to an algorithm that is not a public contract, and a name mismatch in `excludeTools` leaves a disallowed tool available. Recommend the floor raise to 7.0.1 in decision 3, which removes the "accept both forms" branch. Add an `excludeTools` acceptance line. Sources: K-12, ZI-13.

**A-19 State what the test harness can run.** The PRD says the harness cannot run a full background child, yet HOOK-07a, AGENT-01, AGENT-03, and WF-05 specify child scenarios. One sentence: the harness runs a stand-in child with recording hooks and cannot run a real detached child with the scripted model. Mark each affected acceptance. Sources: C-07, ZI-04.

**A-20 Narrow WF-01 and say it is not sufficient.** Section 6 limits the fix to the `Workflow({ name })` call; the requirement text covers every reference without a slash, including prose that tells the user what to type. Pick one. Add that WF-01 is necessary and not sufficient: the engine's tool text tells the model to call `workflow` only on explicit opt-in, and `parallel()` rejects where six of seven scripts expect `null`. Sources: K-06, ZI-15.

**A-21 Keep the door open in HOOK-07a, and record premises with versions.** Shape the child check in HOOK-07a as an event remap, not a skip list, so that `SubagentStart` and `SubagentStop` can later run in the child, where blocking is possible. For decisions whose reason is a fact about another product, record the fact and the version it was checked at; many of the 22 decisions went stale because nothing did. Sources: Z-10, Z-12.

### 🟢 Nit

**A-22 Split or drop riders on small fixes.** HOOK-13 and MCP-01 each also read an environment variable; HOOK-14 adds overflow to a file; PI-01 adds a setting; HOOK-03 bundles three changes of which only one needs decision 6. Source: Z-13.

**A-23 Trim sections 8 and 10.** Keep the outside requests that have use evidence or a dependent requirement; link to the reports for the rest. Section 10 can be a link plus the rows with no owning requirement. Source: Z-16.

**A-24 Record the smaller options the PRD did not examine.** CORE-08: restage or mark stale on `marketplace update` (size S to M) before a per-version copy (size L). HOOK-03: test a compiled pattern at install against the known tool names. Sources: Z-18, Z-19.

**A-25 List enumerations and sample sets where they are used.** "The five MCP fields" is the one a requirement depends on. Name the three sample sets (17 local folders, 21 cached plugins, 76 plugins) once. Sources: C-09, C-11, ZI-14.

**A-26 Clarity nits.** "Pi 0.87.0, below the floor" reads as "not available at the floor". Paths outside the extension break the stated path rule. Harness terms, three synonym sets, and about twenty smaller terms are undefined. MCP-01 leaves `MCP_TOOL_TIMEOUT` unaddressed. HOOK-07a adds `agent_type` and not `agent_id`. Sources: C-13, C-15 to C-19, C-22, C-26, K-23.

**A-27 Structure and wording nits.** Unnumbered and duplicate headings; bold paragraphs acting as headings; the priority line varies in form; a P1 precedes a P0 in 7.1; colloquial phrases; the non-commitment stated three times; four caveats that name no reader decision. Sources: K-24, K-25.

## Where reviewers disagreed, and how stage 8 resolved it

| Question                             | Position A                                                   | Position B                                 | Stage 8 resolution                                                                                  |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Form of the alternatives evaluation  | A line on each P0 and P1 requirement (K-01, design)          | One section is enough (K-01, structural)   | One table of about eight rows, with "open" allowed as a status (ZI-02)                              |
| CORE-03 steps                        | Ship steps 1 and 2 together (K-11)                           | Step 2 is speculative scope (Z-13)         | Step 1 alone, with the rule that a required option with no default keeps the plugin partial (ZI-05) |
| CORE-06                              | Evaluate a consent record kept by the extension (K-03, Z-01) | D-LOC-01 accepted the gap                  | List the consent record as an alternative; add a decision row; do not make it a requirement (ZI-08) |
| AGENT-01 opt-out                     | Specify an opt-out setting (K-05)                            | Fewer settings (Z-13)                      | Name the existing pi-subagents setting; add none (ZI-04)                                            |
| Harness work for background children | Make it a milestone 1 requirement (K-05)                     | --                                         | Not needed; the stand-in child covers HOOK-07a (ZI-04)                                              |
| Risks, limits, architecture sections | Add them (K-02, K-13, K-14)                                  | Cut detail and copied content (Z-09, Z-16) | Sentences in place; no new sections (ZI-03)                                                         |
| Re-check of evidence                 | Re-check every P0 and P1 (K-09)                              | --                                         | One transcription check of the 13 P0 entries (ZI-10)                                                |
| Context for new readers              | Glossary, ID summaries, alias table (C-01, C-02, K-18)       | --                                         | Links and about eight lines; no new glossary (ZI-07)                                                |

The orchestrator has not ruled on these. Stage 8 is one reviewer's judgment from the simplicity lens. On the alternatives Blocker in particular, the zoom-out reviewer cannot waive the feature-spec standard; it only proposes the smallest form that meets it.

## What the reviewers confirmed

- Six code citations were checked in the source and are accurate: `domain/skill-tokens.ts:113-115`, `bridges/hooks/runtime.ts:275-277`, `orchestrators/plugin-path.ts:87-106`, the absence of any reference to `agent_before_settle`, `backgroundForMcp` in `bridges/agents/convert.ts`, and the skills repair path in `bridges/skills/frontmatter-degrade.ts`.
- Heading hierarchy, table syntax, links, section cross-references, and the Spike column against section 9 are consistent.
- Sections 1 to 4 state what is wanted, why, and how far the evidence goes. The "not an emulator" boundary is consistent with the project's stated core value.
- No false compromise was found in MCP-01, MCP-06, WF-01's mechanism, or the CORE-03 step split.

## Traceability Matrix

| Action                           | Priority | Stage 5                | Stage 6                              | Stage 7                | Stage 8      |
| -------------------------------- | -------- | ---------------------- | ------------------------------------ | ---------------------- | ------------ |
| A-01 Alternatives                | Blocker  | --                     | --                                   | K-01                   | ZI-02        |
| A-02 HOOK-03 matcher rule        | Major    | --                     | --                                   | K-08, K-09             | ZI-10        |
| A-03 CORE-06                     | Major    | Z-01                   | C-08                                 | K-03                   | ZI-08        |
| A-04 Workflow tool-list question | Major    | Z-02                   | --                                   | K-04, K-06             | ZI-09        |
| A-05 AGENT-01 premise            | Major    | Z-04                   | C-06                                 | K-05                   | ZI-04        |
| A-06 HOOK-01 first pair          | Major    | Z-06                   | --                                   | K-07                   | --           |
| A-07 Priority definitions        | Major    | Z-03                   | --                                   | K-19, K-20             | ZI-01, ZI-11 |
| A-08 Lists and counts            | Major    | Z-17                   | C-03, C-10, C-20                     | K-15, K-18             | ZI-14        |
| A-09 Decision list               | Major    | Z-14, Z-15             | C-04, C-25                           | K-04                   | ZI-12        |
| A-10 Sequencing                  | Major    | --                     | C-21                                 | K-11                   | ZI-05        |
| A-11 Claims and scales           | Major    | --                     | C-23                                 | K-09, K-19, K-20, K-21 | ZI-10        |
| A-12 Reader context              | Major    | --                     | C-01, C-02, C-12, C-14               | K-17, K-22             | ZI-07        |
| A-13 Requirement forms           | Major    | --                     | C-05                                 | K-16                   | ZI-01        |
| A-14 Behavior and reuse          | Major    | Z-05, Z-08, Z-09, Z-11 | --                                   | --                     | --           |
| A-15 Spike S1 question           | Major    | Z-07                   | --                                   | --                     | --           |
| A-16 Risk sentences              | Major    | --                     | --                                   | K-02, K-13, K-14       | ZI-03        |
| A-17 Two behavior holes          | Major    | --                     | --                                   | K-10, K-11             | ZI-05, ZI-06 |
| A-18 MCP-02                      | Major    | --                     | --                                   | K-12                   | ZI-13        |
| A-19 Harness statement           | Major    | --                     | C-07                                 | K-05                   | ZI-04        |
| A-20 WF-01 scope                 | Major    | --                     | --                                   | K-06                   | ZI-09, ZI-15 |
| A-21 HOOK-07a shape; premises    | Major    | Z-10, Z-12             | --                                   | --                     | --           |
| A-22 Riders                      | Nit      | Z-13                   | --                                   | --                     | --           |
| A-23 Trim sections 8 and 10      | Nit      | Z-16                   | --                                   | --                     | --           |
| A-24 Smaller options             | Nit      | Z-18, Z-19             | --                                   | --                     | --           |
| A-25 Enumerations, sample sets   | Nit      | --                     | C-09, C-11                           | --                     | ZI-14        |
| A-26 Clarity nits                | Nit      | --                     | C-13, C-15 to C-19, C-22, C-24, C-26 | K-23                   | ZI-14        |
| A-27 Structure and wording nits  | Nit      | --                     | --                                   | K-24, K-25             | --           |
