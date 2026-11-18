---
phase: 11-skills-commands-and-records
verified: 2026-11-17T04:12:02Z
status: passed
score: "6/6 must-haves verified (roadmap criteria 1 to 5, criterion 5 checked as PG-DOC-01 and PG-DOC-02); 83 plan truths re-read: 76 hold, 7 superseded in part by the maintainer review of 2026-11-16, none failed; 14 judgment-tier prohibitions flagged"
covered_files: [".planning/phases/11-skills-commands-and-records/11-01-PLAN.md",".planning/phases/11-skills-commands-and-records/11-01-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-02-PLAN.md",".planning/phases/11-skills-commands-and-records/11-02-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-03-PLAN.md",".planning/phases/11-skills-commands-and-records/11-03-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-04-PLAN.md",".planning/phases/11-skills-commands-and-records/11-04-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-05-PLAN.md",".planning/phases/11-skills-commands-and-records/11-05-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-06-PLAN.md",".planning/phases/11-skills-commands-and-records/11-06-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-07-PLAN.md",".planning/phases/11-skills-commands-and-records/11-07-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-08-PLAN.md",".planning/phases/11-skills-commands-and-records/11-08-SUMMARY.md","CHANGELOG.md","README.es.md","README.md","docs/env-vars.md","docs/mcp-compatibility.md","docs/prd/parity-gaps-prd.md","docs/prd/pi-claude-marketplace-prd.md","docs/research/claude-hooks-vs-pi-events.md","docs/skills-commands-compatibility.md","extensions/pi-claude-marketplace/bridges/commands/command-record.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts","extensions/pi-claude-marketplace/bridges/skills/skill-names.ts","extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts","extensions/pi-claude-marketplace/domain/context-injection.ts","extensions/pi-claude-marketplace/domain/file-mentions.ts","extensions/pi-claude-marketplace/domain/mcp-resolution.ts","extensions/pi-claude-marketplace/domain/name.ts","extensions/pi-claude-marketplace/edge/skill-aliases.ts","extensions/pi-claude-marketplace/orchestrators/command-invocation.ts","extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts","extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts","extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts","features/mcp-server/sources.feature","features/skill/aliases.feature","features/skill/invocation.feature","features/slash-command/aliases.feature","features/slash-command/frontmatter.feature","features/slash-command/invocation.feature","test/bridges/commands/command-record.test.ts","test/bridges/commands/stage.test.ts","test/bridges/commands/staged-command.test.ts","test/bridges/skills/skill-names.test.ts","test/domain/context-injection.test.ts","test/domain/file-mentions.test.ts","test/domain/name.test.ts","test/edge/skill-aliases.test.ts","test/orchestrators/command-invocation.test.ts","test/orchestrators/mention-attachments.test.ts","test/orchestrators/skill-alias-state.test.ts","test/orchestrators/skill-invocation.test.ts","test/orchestrators/typed-expansion.test.ts"]
covered_digest: "v4:sha256:7f68b0e14453ec180f8d5ecbdbeff59705c674b09d931c7f313f9951d589f1a9"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: "6/6 (6 verified, 0 by override)"
  previous_verified: 2026-11-17T01:58:40Z
  reason: "staleness after the docs-only commit 421863f6 ('docs: align decision wording with the maintainer review'), then ebcce31e. Of the covered files, 421863f6 changed docs/env-vars.md (D-PG10-19 now 'confirmed by the maintainer'), docs/mcp-compatibility.md (dropped 'pending maintainer review' from the D-PG9-01, -08, -16 sentences; pointed the workflow-tools question at BACKLOG AGTWORKFLOWAMBIENT-01), and docs/prd/parity-gaps-prd.md (the decision-14 sentence now records D-PG8-07 keep-last). It also edited 11-SECURITY.md (T-11-06 restated after the D-PG11-03 reversal, T-11-24 and the review-fix note updated) and 11-CONTEXT.md (a 2026-11-16 status note and notes on the locked D-PG11-01/02/06 and the D-PG11-03 reversal), neither of them covered. ebcce31e changed one sentence of docs/mcp-compatibility.md:435 (D-PG7-17, confirmed). No source, test, feature, README, CHANGELOG, compatibility-page, PROJECT.md, or REQUIREMENTS.md byte changed since the previous basis 333784b7 (`git diff --quiet 333784b7 HEAD -- extensions test features ...` exits 0). This pass re-checked those edits against the code and the decision rows."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  overrides_kept: []
  overrides_added: []
  overrides_removed: []
  history: "The pass of 2026-11-17T01:58:40Z removed the D-PG11-03 mask override (the maintainer reversed the decision; c6812df5, 9e3dc68b). That removal stands."
  advisories_closed:
    - "Previous advisory 1 (11-CONTEXT.md calls D-PG11-01/02/06 pending): 421863f6 added a status note (11-CONTEXT.md:14-19) that the maintainer locked D-PG11-01 and D-PG11-02 as confirmed, confirmed D-PG11-06 as deferred, and reversed D-PG11-03, and that PROJECT.md and REQUIREMENTS.md hold the current decision where the recorded discussion conflicts. The '### Pending maintainer review' list (:261) now opens with 'All three were settled by the maintainer review of 2026-11-16'. This matches PROJECT.md:2442-2444 and :2755, and BACKLOG MENTIONDIR-01 (:5510). Residual: the intro (:8, :12) and the D-PG11-01 entry heading (:55) keep the recorded 'pending maintainer review' wording without an inline 'confirmed' tag (the D-PG11-02 heading at :109 has one); the status note covers them. Info only."
    - "Previous advisory 2 (11-SECURITY.md T-11-06 names the removed masks): the row (:41) now cites `findFileMentions` scanning the body after `withoutContextInjections()` (`ext/domain/context-injection.ts`) for `!` text, with context-injection.test.ts, the D-PG11-02 cases of file-mentions.test.ts, and `slash-command/invocation.feature:397`, and records example code as no longer masked and under AR-11-02. Checked against the code: `withoutContextInjections` is exported at E/domain/context-injection.ts:170 and replaces each `findInjections` pattern with `!`; E/domain/file-mentions.ts imports it at :27 and calls it at :141 (`const text = withoutContextInjections(body)`); test/domain/context-injection.test.ts:247 calls it; test/domain/file-mentions.test.ts:140, :145, :150 are the D-PG11-02 `!` rows; invocation.feature:397 starts 'A mention in a context command and its output is not attached (PG-SKILL-01)'. All true."
advisory:
  - finding: "11-SECURITY.md T-11-10 (:45) and T-11-11 (:46) cite `slash-command/invocation.feature:377` and `:402`, and the review-fix note (:94) says the citations were updated to those lines. Since c6812df5 those lines are table rows (`| demo | 1.0.0 |`). The scenarios moved to :372 ('A file that a typed argument mentions is not attached') and :397 ('A mention in a context command and its output is not attached'). 421863f6 updated T-11-06 to :397 but not these two rows."
    category: security
    reason: "A stale record, not a lost mitigation: the scenarios still exist and passed in the gate, and this report cites them at :372 and :397. To resolve: change :377 to :372 and :402 to :397 in 11-SECURITY.md rows T-11-10 and T-11-11 (and in the :94 note). This pass edits only the verification report, so it did not change the file."
    evidence_status: "reproducible: `sed -n '45,46p;94p' .planning/phases/11-skills-commands-and-records/11-SECURITY.md` and `sed -n '372p;377p;397p;402p' features/slash-command/invocation.feature`"
  - finding: "11-SECURITY.md T-11-06 (:41) keeps the disposition `mitigate` for both halves, while its example-code half is now accepted under AR-11-02, which the register ties to T-11-14 (:49, :71)."
    category: security
    reason: "Bookkeeping only. AR-11-02's text (an author's mention can name any file the user can read) covers a mention in example code, and the D-PG11-03 row (PROJECT.md:2444) records the parity choice. To resolve, optionally list T-11-06 beside T-11-14 in AR-11-02's threat column."
    evidence_status: "reproducible: `sed -n '41p;49p;71p' .planning/phases/11-skills-commands-and-records/11-SECURITY.md`"
  - finding: "The 11-03 artifact probe `.fallowrc.json contains: domain/file-mentions.ts` still fails (`query verify.artifacts` 2/3, exit 1). This is expected: 11-04 truth 11 requires those lines gone, and fallow passed in the gate."
    category: other
    reason: "A probe that a later plan of the phase meant to fail. No action needed."
    evidence_status: "reproducible by `query verify.artifacts .planning/phases/11-skills-commands-and-records/11-03-PLAN.md`"
prohibitions_flagged: 14
prohibition_review: "NON-AUTHORITATIVE; unverified-prohibition, human review recommended. The 14 judgment-tier prohibitions of plans 11-01 to 11-08 (1, 1, 1, 2, 1, 2, 2, 4; none test-tier) were re-read against the current tree, including the 421863f6 and ebcce31e edits, and no violation was found. Their D-PG11-03 clauses (11-03, 11-04, and 11-08: do not call the code skip parity; 11-07: do not record D-PG11-03 as settled by the maintainer) are superseded: the maintainer settled D-PG11-03 as parity on 2026-11-16. As in the sibling re-verifications, they are listed under maintainer_review and not as manual tests."
# The item below is a review point carried out of the phase; it is not a test of shipped behavior.
maintainer_review:
  - test: "Judgment-tier prohibitions of plans 11-01 to 11-08 (14 items, all verification: judgment, none test-tier)."
    expected: "No comment, title, README, CHANGELOG, record, or doc calls D-PG11-02 or the D-PG11-06 directory rule parity; no text says command names now match Claude Code's; no text says a skill's argument-hint shows everywhere; no file content reaches a debug line; no claim read but not run is stated as measured; no dated audit or BACKLOG entry was rewritten or closed."
    why_human: "The verifier's check is an LLM judgment, not authoritative (see the Prohibitions section). Human review recommended."
human_verification: []
---

# Phase 11: Skills, Commands, and Records Verification Report

**Phase Goal:** A typed plugin command or skill attaches the files its author referenced, a command answers to the name Claude Code gives it, and alias suggestions show what their target does. Skills and commands get a compatibility page whose every row cites its proof, and the records that no requirement owns are corrected.
**Verified:** 2026-11-17T04:12:02Z
**Status:** passed. All five roadmap criteria hold on the current tree, criterion 2 as the maintainer amended it. No override exists. 14 judgment-tier prohibitions are flagged for human review, and 3 advisories are records only.
**Re-verification:** Yes. The previous report (passed, 6/6, no override) became stale after the docs-only commits 421863f6 and ebcce31e.

## Verification Basis

This pass re-checked every roadmap criterion against `features/gaps` at `ae488a8f` (the tree of 421863f6 and ebcce31e plus verification reports of other phases). Summaries, 11-REVIEW-FIX.md, and the previous report were not taken as evidence. **E/** means `extensions/pi-claude-marketplace/`.

**What changed since the previous basis (333784b7):** only docs and planning records. `git diff --quiet 333784b7 HEAD` over `extensions`, `test`, `features`, `CHANGELOG.md`, both READMEs, `docs/skills-commands-compatibility.md`, `docs/research`, `docs/prd/pi-claude-marketplace-prd.md`, `.planning/PROJECT.md`, and `.planning/REQUIREMENTS.md` exits 0. The ROADMAP edit is the phase 10 closeout line only. The covered docs that changed are:

| File | Commit | Change | Effect on this phase |
| --- | --- | --- | --- |
| `docs/env-vars.md` | 421863f6 | D-PG10-19 "pending maintainer review" became "confirmed by the maintainer" | none; the PG-DOC-02 `PATH` rows (:44, :123, "read in its binary and not run") are unchanged |
| `docs/mcp-compatibility.md` | 421863f6, ebcce31e | "pending maintainer review" dropped from the D-PG9-01, -08, and -16 sentences; the workflow-tools question points at AGTWORKFLOWAMBIENT-01; :435 says D-PG7-17 was confirmed | none; the `tool_search` rows (:93, :96) with the codemode reach marked unmeasured, the bundle reason, and the Pi 1.5.0 proof paths are unchanged |
| `docs/prd/parity-gaps-prd.md` | 421863f6 | the decision-14 sentence now says the last of two scripts with one name installs (D-PG8-07) and symbolic links are still refused | none; Phase 8 matter. It matches the PROJECT.md D-PG8-07 row (:2422, "changed by the maintainer review 2026-11-16 for E5"). The section 10 statements that PG-DOC-02 corrected are not touched |

421863f6 also edited two phase records outside the covered list: `11-SECURITY.md` and `11-CONTEXT.md`. Both close previous advisories (see `re_verification.advisories_closed`). Their claims were checked against the code and PROJECT.md:

- T-11-06 (`11-SECURITY.md:41`): `withoutContextInjections` is exported at E/domain/context-injection.ts:170 and replaces each `!` pattern that `findInjections` returns with one `!`. `E/domain/file-mentions.ts` imports it (:27) and calls it on the body (:141). The cited tests exist: `test/domain/context-injection.test.ts:247`, the `D-PG11-02` rows of `test/domain/file-mentions.test.ts` (:140, :145, :150), and `features/slash-command/invocation.feature:397`. Example code is attached, as the reversed D-PG11-03 row (PROJECT.md:2444) and PG-SKILL-01 (REQUIREMENTS.md:74) say, and AR-11-02 (:71) covers the reach. True.
- T-11-24 (`:59`): the rows held "pending maintainer review" until the review of 2026-11-16. PROJECT.md:2442 and :2443 now say "confirmed by the maintainer review 2026-11-16", :2444 says "reversed by the maintainer on 2026-11-16". True.
- 11-CONTEXT.md status note (:14-19) and the "Pending maintainer review" list (:261-264): D-PG11-01 and -02 confirmed, D-PG11-03 reversed, D-PG11-06 deferred. Matches PROJECT.md:2442-2444, the PROJECT.md footer (:2755, "D-PG11-06 (no row) is confirmed as deferred in BACKLOG"), and BACKLOG MENTIONDIR-01 (:5510). True.

**Decision status (PROJECT.md, all locked):**

| Decision | Status | Effect here |
| --- | --- | --- |
| D-PG11-01 | confirmed by the maintainer review 2026-11-16 (:2442) | Criterion 3 and PG-CMD-09 stand. |
| D-PG11-02 | confirmed by the maintainer review 2026-11-16 (:2443) | Criterion 1 stands. |
| D-PG11-03 | reversed by the maintainer on 2026-11-16 (:2444) | Criterion 2 and PG-SKILL-01 (:74) say a mention inside fenced code or a code span is attached, as in Claude Code. |
| D-PG11-06 | no row; deferred (BACKLOG MENTIONDIR-01, :5510; PROJECT.md :2755) | The page lists it under "Deferred". |

**Gate (reused, not re-run):** `/tmp/pg-final2.log`, `npm run check` at `421863f6`. The log's mtime (2026-11-16 22:10:04 -0500) is after the 421863f6 commit (21:56:28 -0500). All seven static checks passed: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features. The unpaired and integration tests passed on Node v26.13.1 with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`. The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps (seed 115283), and the builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 836824). Direct coverage merged 376 LCOV records, and the log ends with `exit=0`. ebcce31e changed one docs sentence after the gate; docs are not build inputs, so the result covers HEAD.

**Independent checks (this pass):** the thirteen owner suites of the phase ran under a fresh `mktemp -d` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad, with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap`: 711/711 pass, exit 0 (the same count as the previous pass; no test changed). `query verification.fingerprint` over the unchanged covered list gives the digest above. No real `~/.pi/agent` or HOME config file was read.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: a command body `Review @${CLAUDE_PLUGIN_ROOT}/templates/x.md` reaches the scripted model with the template text in a `<file>` block. `/demo:review @<path>` gives the model the argument as text with no `<file>` block (PG-SKILL-01). | ✓ VERIFIED | `features/slash-command/invocation.feature:336`, row `as plain text` (:367): the model gets the body, then the `<file name=...templates/x.md>` block. `:372`: body `Review $ARGUMENTS`, the user types `/demo:review @{home}/.../templates/x.md` (an existing file), and the model gets the text only. The scenario uses a fixture file instead of `/etc/hostname`, as D-PG11-13 allows. Skill side: `features/skill/invocation.feature:350` and `:375`. Code: `renderCommand` (command-invocation.ts:216) builds `authored` with `args: undefined` (:222) and passes it to `appendMentionedFiles` (:242); `fillSkill` (skill-invocation.ts:192) does the same (:200, :224). Unchanged since 333784b7; scenarios passed in the gate. D-PG11-02 is confirmed. |
| 2 | SC2, as amended on 2026-11-16: a `@path` in the output of an injected `!` command is not attached; a `@path` inside fenced code or a code span is attached, as in Claude Code (PG-SKILL-01; D-PG11-03 reversed). | ✓ VERIFIED | Not attached: `invocation.feature:397`. The scan input `authored` never holds `!` output, and `withoutContextInjections` (context-injection.ts:170, called at file-mentions.ts:141) removes the command's own text. Attached: the rows `in fenced code` (:368), `in a code span` (:369), and `in a fence on a list item in a blockquote` (:370) of the Outline at `:336`. Unit rows in `test/domain/file-mentions.test.ts` (D-PG11-03 code rows; D-PG11-02 `!` rows at :140, :145, :150) and `test/domain/context-injection.test.ts:225-252` passed here and in the gate. |
| 3 | SC3: with `demo/commands/demo-lint.md`, `/demo:demo-lint x` sends the command body, as `/demo:lint x` does (PG-CMD-09). | ✓ VERIFIED | `features/slash-command/aliases.feature:41` Outline rows `/demo:lint`, `/demo:demo-lint`, `/demo:demo-tools:lint`. Code unchanged: `claudeCommandName` (E/domain/name.ts:546), `claudeName` stored at staging (E/bridges/commands/command-record.ts), `storedClaudeName` (E/orchestrators/skill-alias-state.ts:188), skipped when the frontmatter sets `name` (WR-01, `aliases.feature:147`). D-PG11-01 is confirmed. |
| 4 | SC4: the alias scenarios in `features/skill/aliases.feature` and `features/slash-command/aliases.feature` assert the description column: each alias suggestion shows its target's description and, for a skill, its `argument-hint` (PG-SKILL-11). | ✓ VERIFIED | `skill/aliases.feature:238` (`demo:fancy`, `<change>`, `Reviews a change.`) and `:256`; `slash-command/aliases.feature:130` (`Ships the branch.`); `slash-command/frontmatter.feature:190-196`. The step reads real pi-tui screen rows. Code unchanged: `menuDescription` (E/edge/skill-aliases.ts:41) and `menuText` (skill-alias-state.ts:244). |
| 5 | SC5 (PG-DOC-01): `docs/skills-commands-compatibility.md` covers the dropped fields, `!` injection, `run_plugin_command`, the skill-read fill, and the name mapping, and each row of its status table cites a scenario that passes. | ✓ VERIFIED | The page and every feature file are byte-identical to 333784b7, so the previous citation check holds: 0 bad, 129 distinct citations (133 total), and all 35 status rows cite at least one `features/<dir>/<file>.feature:<line>` that starts a `Scenario` or `Scenario Outline`. All cited scenarios passed in the gate at 421863f6. |
| 6 | SC5 (PG-DOC-02): the eight statements that the PRD's section 10 marks "none" are corrected, and a claim only a spike can settle is marked unmeasured. | ✓ VERIFIED | The eight targets were re-read. `docs/research/claude-hooks-vs-pi-events.md`, `docs/prd/pi-claude-marketplace-prd.md`, `E/domain/mcp-resolution.ts`, `E/bridges/mcp/builtin-overrides.ts`, `E/domain/components/hooks/builtin-mcp-tool-names.ts`, and `features/mcp-server/sources.feature` did not change. The 421863f6 and ebcce31e edits to `docs/mcp-compatibility.md` and `docs/env-vars.md` change decision-status wording only (table above). The `tool_search` rows, the bundle reason, the Pi 1.5.0 proof paths, and the `PATH` rows ("read in its binary and not run", D-PG11-10) are still in place. |

**Score:** 6/6 truths (6 verified, 0 by override, 0 present but behavior-unverified).

### Superseded plan truths

The maintainer review of 2026-11-16 changed the contract that these plan truths were written for. ROADMAP criterion 2, REQUIREMENTS PG-SKILL-01, and the PROJECT.md rows are the contract now, and the plan files were not rewritten. None of them is a failure. Nothing in this table changed since the previous pass.

| Plan truth | Superseded part | What holds on the tree |
| --- | --- | --- |
| 11-03 #2: a mention inside fenced code or a code span is not returned | the code half (D-PG11-03 reversed) | The `!` half holds: an inline `!` span and a ```` ```! ```` fence give `[]` (unit rows `D-PG11-02: reads no mention from...`). |
| 11-03 #9: the module imports nothing outside `shared/` | the import clause | `file-mentions.ts` imports `./context-injection.ts` (:27) to drop `!` command text. That module has no imports and starts no process, so D-PG11-08 purity holds. fallow's boundaries passed in the gate. |
| 11-03 #10: the owner test covers both fence kinds and code spans | the fence-kind rule | The test covers fences and code spans as attached, at 100% direct coverage (gate). |
| 11-04 #3: a mention in fenced code, a code span, or a `!` command's text or output is not attached | the code half | The `!` half holds at `invocation.feature:397`. |
| 11-07 #1: each D-PG11 row has the words "pending maintainer review" | replaced by the maintainer's answers | The rows read "confirmed by the maintainer review 2026-11-16" (01, 02) and "reversed by the maintainer on 2026-11-16" (03). |
| 11-07 #2: the D-PG11-03 row calls the code skip a divergence | reversed | The row records the original choice, the reversal, and the read-not-run premise. |
| 11-08 #3: the page states D-PG11-03 (code skipped) as a difference | reversed | The page states D-PG11-02 and the D-PG11-06 directory rule as differences, and D-PG11-03 as a syntax rule that matches upstream. |

### Plan truths (83, re-read)

| Plan | Truths | Result | Notes |
|------|--------|--------|-------|
| 11-01 | 12 | hold | Name and alias code unchanged; `aliases.feature:41`, `:147`; owner suites pass. |
| 11-02 | 10 | hold | Menu code unchanged; `skill/aliases.feature:238`, `:256`. |
| 11-03 | 10 | 7 hold, 3 superseded in part | See the table above. |
| 11-04 | 12 | 11 hold, 1 superseded in part | #11: `.fallowrc.json` names no `file-mentions` line. #9: the skip debug line names the path and the cause only. |
| 11-05 | 9 | hold | `fillSkill` wiring unchanged; `skill/invocation.feature:350`, `:375`. |
| 11-06 | 12 | hold | See truth 6. |
| 11-07 | 7 | 5 hold, 2 superseded in part | CHANGELOG unchanged since 333784b7. |
| 11-08 | 11 | 10 hold, 1 superseded in part | See truth 5. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `E/domain/file-mentions.ts` | pure mention parser, file block | ✓ VERIFIED | 213 lines; imports `shared/bom.ts` (:25) and `domain/context-injection.ts` (:27); used by `mention-attachments.ts` |
| `E/domain/context-injection.ts` `withoutContextInjections` | `!` command text removed before the scan | ✓ VERIFIED | :170; unit test `test/domain/context-injection.test.ts:225-252` |
| `E/orchestrators/mention-attachments.ts` | stat, size, NUL, and read behind `MentionFileReader` | ✓ VERIFIED | unchanged; used by both invocation orchestrators |
| `E/orchestrators/command-invocation.ts`, `E/orchestrators/skill-invocation.ts` | wiring on the typed paths only | ✓ VERIFIED | unchanged |
| `E/domain/name.ts` `claudeCommandName`, command record, `staged-command.ts` | Claude Code name stored at staging | ✓ VERIFIED | :546, unchanged |
| `E/orchestrators/skill-alias-state.ts`, `E/edge/skill-aliases.ts` | alias from the stored name; menu text | ✓ VERIFIED | unchanged |
| `docs/skills-commands-compatibility.md` | compatibility page with a cited status table | ✓ VERIFIED | unchanged; 35 cited rows |
| `.planning/PROJECT.md` rows D-PG11-01 to 03, D-141-01 amendment | records | ✓ VERIFIED | :2442-2444, locked |
| `.fallowrc.json` (11-03 artifact) | the 11-03 entry lines, removed by 11-04 | expected absent | advisory 3 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| typed command | `appendMentionedFiles` | `renderCommand` after `expandContextInjections` | WIRED | `invocation.feature:336` |
| typed skill and alias | `appendMentionedFiles` | `fillSkill`, blocks inside `skillBlock` | WIRED | `skill/invocation.feature:350` |
| `findFileMentions` | `withoutContextInjections` | scan of the body with `!` patterns removed | WIRED | file-mentions.ts:27, :141; `invocation.feature:397` |
| staging | alias table | `claudeName` in the record, then `storedClaudeName` | WIRED | `aliases.feature:41` |
| staged frontmatter | Pi menu row | `menuText`, then `PluginAliasTarget.menu`, then `menuDescription` | WIRED | `skill/aliases.feature:238` |

No linked file changed since the previous pass, where `query verify.key-links` gave 19/19 over the eight plans.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| file block | `blocks` | real `stat` and `open` of the mentioned file (`NODE_MENTION_FILE_READER`) | yes, the fixture text reaches the scripted model | ✓ FLOWING |
| alias menu row | `target.menu` | staged frontmatter | yes, real pi-tui screen rows | ✓ FLOWING |
| Claude Code alias | `claudeName` | `claudeCommandName(pluginName, sourceName)` at staging | yes, `/demo:demo-lint src` reaches the model | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| owner suites of the phase | `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap` on the `file-mentions`, `context-injection`, `mention-attachments`, `command-invocation`, `skill-invocation`, `skill-alias-state`, `edge/skill-aliases`, `skill-names`, `command-record`, `staged-command`, `commands/stage`, `name`, and `typed-expansion` tests (fresh `HOME` and `PI_CODING_AGENT_DIR`) | 711 pass, 0 fail, exit 0 | ✓ PASS |
| every named scenario | gate log `/tmp/pg-final2.log` at `421863f6` | adapter 2100/2100, builtin 204/204, `exit=0` | ✓ PASS (artifact read, not re-run, per dispatch) |
| T-11-06 claim | `grep -n withoutContextInjections` over `E/domain/` and `test/` | defined at context-injection.ts:170, called at file-mentions.ts:141, tested at context-injection.test.ts:247 | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED. No plan or summary declares a `probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PG-SKILL-01 | 11-03, 11-04, 11-05, 11-07 | attach the `@path` mentions the author wrote that name existing regular text files; not from arguments or `!` output; attached inside code, as in Claude Code (D-PG11-03, reversed 2026-11-16; REQUIREMENTS.md:74) | ✓ SATISFIED | Truths 1, 2 |
| PG-CMD-09 | 11-01, 11-07 | a command also answers to `/<plugin>:<path>:<file>` | ✓ SATISFIED (D-PG11-01 confirmed) | Truth 3 |
| PG-SKILL-11 | 11-02, 11-07 | an alias suggestion shows the target's description and a skill's `argument-hint` | ✓ SATISFIED | Truth 4 |
| PG-DOC-01 | 11-08 | compatibility page; each status row cites its scenario | ✓ SATISFIED | Truth 5 |
| PG-DOC-02 | 11-06 | the eight "none" statements corrected; spike-only claims marked unmeasured | ✓ SATISFIED | Truth 6 |

No orphaned requirements: REQUIREMENTS.md (unchanged since 333784b7) maps exactly these five IDs to Phase 11, each is in a plan's `requirements`, and each is `[x]` and Complete.

### Prohibitions (judgment tier)

All 14 prohibitions in the plans are `verification: judgment`; none is test-tier. This is a non-authoritative LLM-judge verdict: no violation found. The 421863f6 and ebcce31e edits were read for them: none calls D-PG11-02 or the D-PG11-06 rule parity, says command names now match Claude Code's, or says a skill's `argument-hint` shows everywhere. The 11-CONTEXT.md edits add a status note and keep the recorded discussion, so no dated record was rewritten. The D-PG11-03 clauses are superseded, because the maintainer settled D-PG11-03 as parity. Flag: **unverified-prohibition, human review recommended** (maintainer_review).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 421863f6 and ebcce31e changed lines | - | TBD / FIXME / XXX / TODO / HACK | none found | - |
| `11-SECURITY.md` | :45, :46, :94 | T-11-10 and T-11-11 cite `invocation.feature:377` and `:402`, which are now table rows; the scenarios are at :372 and :397 | ℹ️ Info (records) | advisory 1 |
| `11-SECURITY.md` | :41, :71 | T-11-06 keeps `mitigate` for its example-code half, which AR-11-02 (tied to T-11-14) now covers | ℹ️ Info (records) | advisory 2 |
| `11-CONTEXT.md` | :8, :12, :55 | recorded "pending maintainer review" wording kept under the 2026-11-16 status note | ℹ️ Info | covered by the status note (:14-19) |
| `ROADMAP.md` plan list | 11-03, 11-04 lines | the plan descriptions still say "with code masked" and "guards for a path ... from code" | ℹ️ Info | historical plan titles; criterion 2 above them is amended |
| `E/domain/file-mentions.ts` `renderMentionBlock` | - | IN-01 (an empty file attaches an empty block), IN-02 (`#L5-3` or `#L0` attach an empty block) | ℹ️ Info | unchanged; no criterion covers them |
| `E/orchestrators/skill-invocation.ts` | - | IN-03: an attached `</skill>` line followed by a blank line splits Pi's display of the skill block | ℹ️ Info | unchanged; display only |
| `E/domain/file-mentions.ts` | - | IN-04: repeats are removed by text, so `@a.md` and `@./a.md` attach twice | ℹ️ Info | as 11-03 truth 4 specifies |
| `E/domain/name.ts`, `E/bridges/commands/discover.ts` | - | IN-05: a manifest map key `tools/lint` gets the stored name `plugin:tools:lint` (upstream unverified) | ℹ️ Info | unchanged |
| `E/bridges/skills/skill-names.ts` | - | IN-08: `commandUpstreamNames` ignores a frontmatter `name`; the upstream conflict rule is unverified | ℹ️ Info | unchanged |

### Human Verification Required

None for shipped behavior. The attachments are proven on a scripted model's real input, and the menu text on real pi-tui screens. Every D-PG11 decision is locked in PROJECT.md (D-PG11-06 deferred in BACKLOG), so no decision is open. The one open review point is the 14 judgment-tier prohibitions (maintainer_review).

### Gaps Summary

No gaps and no regression. Nothing that the phase delivers changed since the previous pass: 421863f6 and ebcce31e changed decision-status wording in covered docs and two phase records, and no source, test, or feature file. Their claims hold against the code: `!` text is held out of the mention scan by `withoutContextInjections()` (E/domain/context-injection.ts:170, called at E/domain/file-mentions.ts:141), example code is attached as the reversed D-PG11-03 requires, and D-PG11-01 and -02 are confirmed. The two previous record advisories on 11-CONTEXT.md and T-11-06 are closed. Three advisories remain, all records: the stale `:377` and `:402` citations of T-11-10 and T-11-11 in 11-SECURITY.md, the T-11-06 disposition bookkeeping, and the expected 11-03 artifact probe failure.

---

_Verified: 2026-11-17T04:12:02Z_
_Verifier: Claude (gsd-verifier)_
