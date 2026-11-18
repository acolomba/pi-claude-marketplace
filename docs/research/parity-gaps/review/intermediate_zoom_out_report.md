# Goldfish Review Report: Stage 8 (Intermediate Zoom Out)

**Target:** `docs/prd/parity-gaps-prd.md` (lines 1-855, full file)

**Focus:** The target was not edited between stages (uninterrupted mode). This stage weighs the additions that the Comprehension stage (`comprehension_report.md`, C-nn) and the Critic stage (`critic_report.md`, K-nn) ask for against the Stage 5 findings (`zoom_out_report.md`, Z-nn).

## Reviewer Status

| Reviewer       | Status    |
| -------------- | --------- |
| `egm-zoom-out` | completed |

No Blocker under the zoom-out standard. 10 Major, 5 Nit. Stages 6 and 7 together ask for four new sections and two or three new fields on about 80 requirements. Most of that is not needed for milestone planning. About 14 small edits make the document fit its purpose.

## Prioritized Findings (Blockers -> Major -> Nits)

### ZI-01 The requested additions, taken together, would bloat the document - Severity: Major

- **Affected Scope:** K-01, K-02, K-13, K-14, C-05, K-16, K-20, K-04, C-02, against Z-03, Z-09, Z-16
- **Discrepancy Description**: Stage 5 asked to cut implementation detail, zero-use rows, and copied report content. Stages 6 and 7 ask for alternatives, risks, limits, and architecture sections, plus Acceptance, Enabler, Risk, and Alternatives fields on each row. Filling fields on rows that Z-03 would move to P3 is wasted work.
- **Rationale & Recommendation**: Re-tier first (Z-03), then fill fields only on what stays in P0 and P1. Declare two forms at lines 11, 221, and 855: a full form for P0 and long-form P1, and a one-line form for the rest.

### ZI-02 The alternatives Blocker (K-01) needs only a short table, and its "rejection reason" rule conflicts with open choices - Severity: Major

- **Affected Scope:** K-01, against Z-01, Z-06, K-03, K-07
- **Discrepancy Description**: An Alternatives line on all 42 P0 and P1 rows is boilerplate; most are single-path defects such as WF-01, CORE-01, and HOOK-13. K-01 also demands a rejection reason for each alternative, but Z-06, K-07, Z-01, and K-03 say several of these choices are still open.
- **Rationale & Recommendation**: Add one table of about eight rows, only where a real fork exists: AGENT-01, HOOK-01, HOOK-02, CORE-06, MCP-01, MCP-02, WF-03, AGENT-05. Give each alternative one line with a status of "rejected, because" or "open, see decision n". Most of the content already exists in Z-01, Z-05, Z-06, Z-07, Z-08, and K-01. The zoom-out reviewer cannot waive the feature-spec standard; the structural reviewer already said one section satisfies it.

### ZI-03 K-02 and K-13 should shrink to sentences; K-14 to one sentence - Severity: Major

- **Affected Scope:** K-02, K-13, K-14
- **Discrepancy Description**: The three findings ask for a risk field or section, a limits section, and an architecture section.
- **Rationale & Recommendation**: K-02: restore the four risk sentences that the reports already hold (MCP-01, AGENT-01, WF-01, AGENT-05) into the Notes of those requirements. Replace a migration section with one sentence: existing installs converge on `update` or `reinstall`. Flag the seven requirements that rename or remove artifacts: CORE-01, AGENT-05, CORE-02, WF-06, AGENT-01, MCP-01, MCP-06. K-13: reject the limits section; the values are Claude Code's own, are owned by pi-subagents, are already asked in S1, or sit behind decision 22, and a ceiling would be a speculative setting and a new divergence. K-14: reject the architecture section; one sentence says architecture is deferred to design, with a link to `.planning/codebase/ARCHITECTURE.md`.

### ZI-04 K-05 asks for three additions to AGENT-01; only one is needed - Severity: Major

- **Affected Scope:** K-05, C-06, C-07, Z-04; lines 598-607
- **Discrepancy Description**: K-05 asks for an opt-out setting, for the harness work (AGTASYNC-01) as a milestone 1 requirement, and for a probe spike.
- **Rationale & Recommendation**: Opt-out: do not add. pi-subagents already has the user setting `asyncByDefault`, cited at line 604; name it as the opt-out. AGTASYNC-01 as a requirement: do not add. `features/plugin/subagent-child.feature` already runs a stand-in child with recording hooks, and HOOK-07a's acceptance fits that stand-in; AGENT-02 already has a pinned-text fallback. Harness statement: add one sentence saying the harness can run a marker stand-in child and cannot run a real detached child with the scripted model; mark AGENT-01, AGENT-02, AGENT-03, and WF-05 accordingly (answers C-07). Probe spike: add. All three stages agree. Add one spike row that re-runs the 2.1.316 probe interactively, and put that question in decision row 1. Replace "false" at lines 26, 84, 603, and 832 with K-05's wording. Per-child MCP processes: one clause in S2 is enough.

### ZI-05 K-11 and Z-13 pull CORE-03 in opposite directions - Severity: Major

- **Affected Scope:** K-11, Z-13; lines 707-719
- **Discrepancy Description**: K-11 says to ship steps 1 and 2 together. Z-13 says step 2 (an install flag, a new verb, and stored values) rests on one plugin whose options all have defaults.
- **Rationale & Recommendation**: Take the smaller path. Step 1 stands alone with one added rule: a `required` option with no default keeps the plugin partially available. The secret-on-command-line question then belongs to step 2. Also accept from K-11: move AGENT-07 (b) beside AGENT-02, and list prerequisites for milestones 2 and 4.

### ZI-06 K-10 is a real gap, but its fix prescribes a design - Severity: Major

- **Affected Scope:** K-10, against Z-09; lines 236-238
- **Discrepancy Description**: "Recognize tokens in the author's static text only, then fill variables inside them" is an implementation rule, and so is a size limit.
- **Rationale & Recommendation**: State the behavior: an `@path` that arrives through arguments from the model, or through `!` command output, is not attached. Add the ordering question to S8. Leave the limit and symbolic links to design.

### ZI-07 C-01, C-02, C-12, K-17, and K-22 are answered by links, not a new glossary - Severity: Major

- **Affected Scope:** Sections 1 and 5
- **Discrepancy Description**: A glossary exists in `docs/prd/pi-claude-marketplace-prd.md` section 3. The architecture file covers the layers. The rule at line 80 is the "Upstream parity" constraint in `AGENTS.md`.
- **Rationale & Recommendation**: Add about eight lines to section 1: links to the glossary and the architecture file; one sentence that names the three record locations (`.planning/PROJECT.md`, `.planning/BACKLOG.md`, and the main PRD); one line for each of the four companion extensions; definitions only for the terms the glossary lacks (bridge, stage, install note, profile). Caveat: the glossary's Component entry lists hooks as unsupported; refresh it or note it before linking. Do not add a one-line summary for every cited ID.

### ZI-08 CORE-06: three stages agree, so its weight rises; the consent record should not become a requirement - Severity: Major

- **Affected Scope:** Z-01, C-08, K-03; lines 32, 697-705, 753
- **Discrepancy Description**: The fix closes only the case where Pi does ask for trust and the answer is no or pending. It does not close the committed `state.json` case that the "Today" bullet describes. A consent record kept by the extension is a second trust system, with its own prompt, storage, and behavior in non-interactive modes. D-LOC-01 records the gap as accepted.
- **Rationale & Recommendation**: State what the fix closes, move CORE-06 out of P0, add one decision row ("D-LOC-01 accepted gap: confirm or reopen"), and list the consent record as an alternative with its costs.

### ZI-09 Spike S4 belongs before milestone 1, for a stronger reason than K-06 gives - Severity: Major

- **Affected Scope:** Z-02, K-04, K-06; lines 577, 800, 850
- **Discrepancy Description**: K-06 says WF-01 widens the exposure. The exposure already exists: a user can start a saved workflow by its typed command. So S4 does not depend on WF-01.
- **Rationale & Recommendation**: Give the question an ID and move the spike to milestone 1; the document says one live run settles it. Add one sentence to WF-01: it is necessary, not sufficient, because the engine's gate text and the `parallel()` behavior remain.

### ZI-10 K-08 must be fixed, and it narrows what K-09 should ask for - Severity: Major

- **Affected Scope:** Line 318; lines 71-76
- **Discrepancy Description**: The reviewer confirmed K-08: `hooks.md` row U9 gives `/^[a-zA-Z0-9_|, -]+$/`, with the space. HOOK-03 is in the list of re-checked claims at line 75, so the second review checked reports against sources, not this document against the reports. K-09's remedy, a re-check of all 42 P0 and P1 items, is work that each milestone's planning repeats anyway.
- **Rationale & Recommendation**: Run one transcription check of the 13 P0 entries against their reports. Add one sentence at the top of section 2 that the findings come from source reading. Fix the overclaim at line 28.

### ZI-11 Promote one item from K-23: a named success set - Severity: Nit (recommended)

- **Affected Scope:** Section 1
- **Rationale & Recommendation**: One short paragraph names the official plugins that must work end to end (for example `security-guidance`, `hookify`, `ralph-loop`, `code-modernization`, `claude-security`, and the five `anthropics/skills` plugins). It gives Z-03 its tiering test, K-19 its selection rule, and K-06 its end-to-end statement. One device replaces three requested additions.

### ZI-12 Decisions: complete the list without widening the gate - Severity: Nit

- **Affected Scope:** K-04, C-04, C-25, against Z-14
- **Rationale & Recommendation**: Split section 5 into "gates P0 and P1" and "can wait". Put the six small "record or remove" divergences (lines 407-411, 575, 665, 737) into one row. Skip a Question column; reword rows 4, 18, 19, and 22 to end with the question.

### ZI-13 MCP-02 (K-12) - Severity: Nit

- **Rationale & Recommendation**: Recommend the floor raise to 7.0.1 in decision 3. That removes the "accept both forms" branch and its run-time version detection. Add one `excludeTools` acceptance line. The built-in path already recomputes a shortened name, so the coupling follows an existing pattern. The export request is at most one row in section 8.

### ZI-14 Smallest forms for the remaining clarity findings - Severity: Nit

- **Rationale & Recommendation**: C-09: list only "the five MCP fields" (line 715). C-11: one sentence that names the three sample sets; its weight rises if Z-03 makes usage counts the tiering test. K-18: one sentence at line 60, not an alias table. K-20: use the three defined confidence values; do not add a usage column. C-24: already answered by `docs/research/parity-gaps/README.md` ("the PRD is right"); no change. C-13: the text is right; reword it to "Pi 0.87.0, older than the 1.5.0 floor".

### ZI-15 WF-01 scope is stated in two ways - Severity: Nit

- **Affected Scope:** K-06; lines 122 and 532
- **Discrepancy Description**: Section 6 limits the fix to `Workflow({ name })`. Line 532 covers every reference without a slash, including prose that tells the user what to type. The acceptance covers only the tool call.
- **Rationale & Recommendation**: Pick one.

## Smallest change set for milestone planning

01. Fix line 318 (K-08) and run a transcription check of the 13 P0 entries.
02. Section 2: add the source-reading sentence, fix line 28, and state the selection rule or the success set.
03. CORE-06: state what it closes, and re-tier it.
04. AGENT-01: reword the premise, add the probe spike, and name `asyncByDefault`.
05. HOOK-01: replace the first-pair rule with a behavior statement: "no pair of a multi-pair edit escapes a matching hook".
06. Give IDs to S4, decision 20, and the trust-path gap; move S4 to milestone 1.
07. Reconcile section 6 with section 7 and the count of 76; fix lines 60, 842, and 855.
08. Section 11: list prerequisites for each milestone; move AGENT-07 (b) beside AGENT-02.
09. Section 1: add the links, the record locations, the four companions, and the four missing terms.
10. Declare the two requirement forms; add Acceptance only to the P1 table rows that survive re-tiering.
11. Add the alternatives table (about eight rows).
12. Add four risk sentences and one existing-installs sentence.
13. Add one harness sentence and one architecture-deferred sentence.
14. SKILL-01 and CORE-03: add the two behavior rules from ZI-05 and ZI-06.

Stage 5 findings Z-05, Z-07, Z-08, Z-09, Z-11, Z-12, Z-13, Z-16, Z-18, and Z-19 stand unchanged.

## Do not add

- An Alternatives or Risk field on every requirement.
- A limits section, an architecture section, or a migration section.
- A project opt-out setting for AGENT-01.
- AGTASYNC-01 as a milestone 1 requirement.
- A consent store kept by the extension, as a requirement.
- A new glossary.
- One line for every cited record ID.
- An ID alias table.
- A Question column in section 5.
- A usage column in every table.
- A re-check of all P1 items inside this document.
