---
phase: 11-skills-commands-and-records
verified: 2026-11-17T01:58:40Z
status: passed
score: "6/6 must-haves verified (roadmap criteria 1 to 5, criterion 5 checked as PG-DOC-01 and PG-DOC-02); 83 plan truths re-read: 76 hold, 7 superseded in part by the maintainer review of 2026-11-16, none failed; 14 judgment-tier prohibitions flagged"
covered_files: [".planning/phases/11-skills-commands-and-records/11-01-PLAN.md",".planning/phases/11-skills-commands-and-records/11-01-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-02-PLAN.md",".planning/phases/11-skills-commands-and-records/11-02-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-03-PLAN.md",".planning/phases/11-skills-commands-and-records/11-03-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-04-PLAN.md",".planning/phases/11-skills-commands-and-records/11-04-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-05-PLAN.md",".planning/phases/11-skills-commands-and-records/11-05-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-06-PLAN.md",".planning/phases/11-skills-commands-and-records/11-06-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-07-PLAN.md",".planning/phases/11-skills-commands-and-records/11-07-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-08-PLAN.md",".planning/phases/11-skills-commands-and-records/11-08-SUMMARY.md","CHANGELOG.md","README.es.md","README.md","docs/env-vars.md","docs/mcp-compatibility.md","docs/prd/parity-gaps-prd.md","docs/prd/pi-claude-marketplace-prd.md","docs/research/claude-hooks-vs-pi-events.md","docs/skills-commands-compatibility.md","extensions/pi-claude-marketplace/bridges/commands/command-record.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts","extensions/pi-claude-marketplace/bridges/skills/skill-names.ts","extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts","extensions/pi-claude-marketplace/domain/context-injection.ts","extensions/pi-claude-marketplace/domain/file-mentions.ts","extensions/pi-claude-marketplace/domain/mcp-resolution.ts","extensions/pi-claude-marketplace/domain/name.ts","extensions/pi-claude-marketplace/edge/skill-aliases.ts","extensions/pi-claude-marketplace/orchestrators/command-invocation.ts","extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts","extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts","extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts","features/mcp-server/sources.feature","features/skill/aliases.feature","features/skill/invocation.feature","features/slash-command/aliases.feature","features/slash-command/frontmatter.feature","features/slash-command/invocation.feature","test/bridges/commands/command-record.test.ts","test/bridges/commands/stage.test.ts","test/bridges/commands/staged-command.test.ts","test/bridges/skills/skill-names.test.ts","test/domain/context-injection.test.ts","test/domain/file-mentions.test.ts","test/domain/name.test.ts","test/edge/skill-aliases.test.ts","test/orchestrators/command-invocation.test.ts","test/orchestrators/mention-attachments.test.ts","test/orchestrators/skill-alias-state.test.ts","test/orchestrators/skill-invocation.test.ts","test/orchestrators/typed-expansion.test.ts"]
covered_digest: "v4:sha256:e1b17056a74fb275870d30c9e4ea206c34757ed3dbf2f3e02fafe9651eaeed0b"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: "7/7 (6 verified, 1 passed by override: the two remaining CommonMark gaps of the D-PG11-03 code mask)"
  previous_verified: 2026-11-16T08:12:30Z
  reason: "staleness after the maintainer review of 2026-11-16. The maintainer reversed D-PG11-03: c6812df5 removed the code mask from domain/file-mentions.ts (626 to 213 lines), added `withoutContextInjections` to domain/context-injection.ts so that a `!` command's own text is still not read, moved the fenced-code, code-span, and blockquote-list-fence rows of features/slash-command/invocation.feature from the not-attached Outline into the attach Outline, and cut test/domain/file-mentions.test.ts to the parse rules. 9e3dc68b amended ROADMAP criterion 2, REQUIREMENTS PG-SKILL-01, the PROJECT.md D-PG11-03 row, 11-CONTEXT.md, the compatibility page, the CHANGELOG, and the parity-gaps PRD. Other covered files changed for unrelated work (D-PG10-25 options, D-PG8-18 workflow names, pi-subagents 0.88.1 wording)."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  overrides_kept: []
  overrides_changed: []
  overrides_added: []
  overrides_removed:
    - "11-03 truth (CommonMark agreement of the D-PG11-03 mask), accepted_by 'orchestrator (autonomous run, pending maintainer review)'. Removed, not converted: the maintainer reversed the decision it rested on, so the must-have no longer exists. ROADMAP criterion 2 now says a `@path` inside fenced code or a code span is attached, as in Claude Code (D-PG11-03 reversed 2026-11-16), REQUIREMENTS PG-SKILL-01 says the same, and the PROJECT.md D-PG11-03 row reads '-- Reversed 2026-11-16 (maintainer)'. The mask, and with it both CommonMark gaps (HTML block, 100-container bound), is gone from the code."
  maintainer_answers_applied:
    - "D-PG11-01: confirmed (PROJECT.md row: '-- Locked (maintainer review 2026-11-16, confirmed)'). PG-CMD-09 stands; criterion 3 unchanged."
    - "D-PG11-02: confirmed (same row status). Criterion 1 stands."
    - "D-PG11-03: reversed. Criterion 2 amended; the override is removed."
    - "D-PG11-06: deferred to BACKLOG MENTIONDIR-01 (.planning/BACKLOG.md:5510, 'deferred by the maintainer review 2026-11-16'). It has no PROJECT.md row, and the page lists it under 'Deferred' (docs/skills-commands-compatibility.md:172)."
  advisories_closed:
    - "Previous advisory 1 (11-CONTEXT.md D-PG11-03 residual text): 9e3dc68b rewrote the D-PG11-03 entry as reversed."
    - "Previous advisory 2 (HTML-block fence effect not documented): moot, the mask is gone."
advisory:
  - finding: "11-CONTEXT.md still calls D-PG11-01 and D-PG11-02 'pending maintainer review' (:8-12, :48, :100), and its '### Pending maintainer review' list (:251-259) still holds D-PG11-01, D-PG11-02, and D-PG11-06. PROJECT.md:2442-2443 lock D-PG11-01 and D-PG11-02 as confirmed, and BACKLOG MENTIONDIR-01 records D-PG11-06 as deferred."
    category: other
    reason: "Records only; no behavior depends on it. To resolve: mark D-PG11-01 and D-PG11-02 confirmed and D-PG11-06 deferred (MENTIONDIR-01) in 11-CONTEXT.md. This pass commits only the verification report, so it did not edit the file."
    evidence_status: "reproducible: `grep -n -i 'pending maintainer' .planning/phases/11-skills-commands-and-records/11-CONTEXT.md`"
  - finding: "11-SECURITY.md:41 still names `ext/domain/file-mentions.ts` fence and span masks as the mitigation of T-11-06 (a mention in `!` text or example code). The `!` text half is now mitigated by `withoutContextInjections` (domain/context-injection.ts:170, called at domain/file-mentions.ts:141). The example-code half is no longer mitigated, by the maintainer's choice of upstream parity (D-PG11-03 reversed)."
    category: security
    reason: "A stale record, not a new exposure: an author-named file in example code is attached, as Claude Code attaches it, and an author can already read any file with a `!` command (D-PG11-08). To resolve: amend the T-11-06 row to cite `withoutContextInjections` for the `!` half and to record the code half as accepted under the reversed D-PG11-03."
    evidence_status: "reproducible: `sed -n 41p .planning/phases/11-skills-commands-and-records/11-SECURITY.md`"
  - finding: "The 11-03 artifact probe `.fallowrc.json contains: domain/file-mentions.ts` still fails (`query verify.artifacts` 2/3, exit 1). This is expected: 11-04 truth 11 requires those lines gone, and fallow passed in Gate G."
    category: other
    reason: "A probe that a later plan of the phase meant to fail. No action needed."
    evidence_status: "reproducible by `query verify.artifacts .planning/phases/11-skills-commands-and-records/11-03-PLAN.md`"
prohibitions_flagged: 14
prohibition_review: "NON-AUTHORITATIVE; unverified-prohibition, human review recommended. The 14 judgment-tier prohibitions of plans 11-01 to 11-08 (1, 1, 1, 2, 1, 2, 2, 4; none test-tier) were re-read against the current tree, and no violation was found. Their D-PG11-03 clauses (11-03, 11-04, and 11-08: do not call the code skip parity; 11-07: do not record D-PG11-03 as settled by the maintainer) are superseded: the maintainer settled D-PG11-03 as parity on 2026-11-16. As in the Phase 4/6/7/9/10 re-verifications, they are listed under maintainer_review and not as manual tests."
# The item below is a review point carried out of the phase; it is not a test of shipped behavior.
maintainer_review:
  - test: "Judgment-tier prohibitions of plans 11-01 to 11-08 (14 items, all verification: judgment, none test-tier)."
    expected: "No comment, title, README, CHANGELOG, record, or doc calls D-PG11-02 or the D-PG11-06 directory rule parity; no text says command names now match Claude Code's; no text says a skill's argument-hint shows everywhere; no file content reaches a debug line; no claim read but not run is stated as measured; no dated audit or BACKLOG entry was rewritten or closed."
    why_human: "The verifier's check is an LLM judgment, not authoritative (see the Prohibitions section). Human review recommended."
human_verification: []
---

# Phase 11: Skills, Commands, and Records Verification Report

**Phase Goal:** A typed plugin command or skill attaches the files its author referenced, a command answers to the name Claude Code gives it, and alias suggestions show what their target does. Skills and commands get a compatibility page whose every row cites its proof, and the records that no requirement owns are corrected.
**Verified:** 2026-11-17T01:58:40Z
**Status:** passed. All five roadmap criteria hold on the current tree, criterion 2 as the maintainer amended it. No override remains. 14 judgment-tier prohibitions are flagged for human review, and 3 advisories are records only.
**Re-verification:** Yes. The previous report (passed, 7/7, one override) became stale after the maintainer review of 2026-11-16 reversed D-PG11-03 (c6812df5, 9e3dc68b).

## Verification Basis

This pass re-checked every roadmap criterion and the 83 plan truths of the eight plans against `features/gaps` at `333784b7`. Summaries, 11-REVIEW-FIX.md, and the previous report were not taken as evidence. **E/** means `extensions/pi-claude-marketplace/`.

**What the maintainer review changed:**

| Decision | Answer (2026-11-16) | Effect here |
| --- | --- | --- |
| D-PG11-01 | confirmed (PROJECT.md:2442, "Locked (maintainer review 2026-11-16, confirmed)") | Criterion 3 and PG-CMD-09 stand. |
| D-PG11-02 | confirmed (PROJECT.md:2443, same status) | Criterion 1 stands. |
| D-PG11-03 | reversed (PROJECT.md:2444, "Reversed 2026-11-16 (maintainer)") | ROADMAP criterion 2 and REQUIREMENTS PG-SKILL-01 (:74) now say a mention inside fenced code or a code span is attached, as in Claude Code. The code mask is gone. The previous override is removed. |
| D-PG11-06 | deferred (BACKLOG MENTIONDIR-01, :5510) | No PROJECT.md row is needed; the page lists it under "Deferred" (:172). |

**What moved in the code:** `E/domain/file-mentions.ts` went from 626 to 213 lines. `blockLine`, `lineRole`, `maskCode`, `MAX_CONTAINERS`, and the rest of the container model are gone. `findFileMentions` (:140) now scans `withoutContextInjections(body)` (:141), which replaces each `!` command pattern with one `!` (E/domain/context-injection.ts:170, built on the existing `findInjections`). `context-injection.ts` has no imports and starts no process (its header, :11-12), so `file-mentions.ts` stays pure. The invocation orchestrators did not change: `renderCommand` (E/orchestrators/command-invocation.ts:216) and `fillSkill` (E/orchestrators/skill-invocation.ts:192) still pass `authored` (arguments not substituted, `!` not run) to `appendMentionedFiles`.

**Gate G (reused, not re-run):** `/tmp/pg-final.log`, `npm run check` at `333784b7` (log mtime 20:52, after the HEAD commit at 20:38, so it ran on HEAD). The verifier read the log. All seven static checks passed: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features. The unpaired and integration tests passed on Node v26.13.1 with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`. The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps (seed 478645). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 413244). Direct coverage merged 376 LCOV records, and the log ends with `exit=0`. The dispatch states that the run used a hermetic `PI_CODING_AGENT_DIR`.

**Independent checks (this pass):** the thirteen owner suites of the phase, now including `test/domain/context-injection.test.ts`, ran under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad, with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap`: 711/711 pass. The total is lower than the previous 738 because c6812df5 removed the mask rows from `file-mentions.test.ts`. A direct probe of `findFileMentions` at HEAD gave: fence `["a.md"]`, code span `["b.md"]`, tilde fence `["c.md"]`, inline `!` command `[]`, `!` fence `[]`, plain text `["g.md"]`. `query verify.key-links` gives 19/19 links over the eight plans. `query verify.artifacts` gives the full count for seven plans and 2/3 for 11-03 (advisory 3). No real `~/.pi/agent` or HOME config file was read.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: a command body `Review @${CLAUDE_PLUGIN_ROOT}/templates/x.md` reaches the scripted model with the template text in a `<file>` block. `/demo:review @<path>` gives the model the argument as text with no `<file>` block (PG-SKILL-01). | ✓ VERIFIED | `features/slash-command/invocation.feature:336`, row `as plain text` (:367): the model gets the body, then `<file name="{home}/.../templates/x.md">\nCheck the spelling.\n</file>`. `:372`: body `Review $ARGUMENTS`, the user types `/demo:review @{home}/.../templates/x.md` (an existing file), and the model gets the text only. The scenario uses a fixture file instead of `/etc/hostname`, as D-PG11-13 allows; an existing file makes the guard stronger. Skill side: `features/skill/invocation.feature:350` (typed alias, block inside `</skill>`) and `:375` (argument not attached). Code: `renderCommand` (command-invocation.ts:216) builds `authored` with `args: undefined` (:222) and passes it to `appendMentionedFiles` (:242). `fillSkill` (skill-invocation.ts:192) does the same (:200, :224). D-PG11-02 is confirmed. |
| 2 | SC2, as amended on 2026-11-16: a `@path` in the output of an injected `!` command is not attached; a `@path` inside fenced code or a code span is attached, as in Claude Code (PG-SKILL-01; D-PG11-03 reversed). | ✓ VERIFIED | Not attached: `invocation.feature:397`, body ``Shown: !`echo @${CLAUDE_PLUGIN_ROOT}/templates/x.md` ``. The model gets `Shown: @{home}/.../x.md`, the `!` output, with no block. The scan input `authored` never holds `!` output, and `withoutContextInjections` (file-mentions.ts:141) removes the command's own text. Attached: the rows `in fenced code` (:368), `in a code span` (:369), and `in a fence on a list item in a blockquote` (:370) of the attach Outline at `:336`. Each gives the body, then the file block. These rows sat in the not-attached Outline under the mask and passed there, so they now tell the two behaviors apart. Unit: `test/domain/file-mentions.test.ts` rows `D-PG11-03: reads a mention inside a fence`, `...inside a code span`, `...cuts the closing backtick`, and `D-PG11-02: reads no mention from an inline ! command`, `...from a ! fence`, `...right after a ! command`. All of these passed in Gate G. |
| 3 | SC3: with `demo/commands/demo-lint.md`, `/demo:demo-lint x` sends the command body, as `/demo:lint x` does (PG-CMD-09). | ✓ VERIFIED | `features/slash-command/aliases.feature:41` Outline rows `/demo:lint`, `/demo:demo-lint`, and `/demo:demo-tools:lint`. Code unchanged since the previous report: `claudeCommandName` (E/domain/name.ts:546; the later edits to `name.ts` touch only the workflow names, D-PG8-18), `claudeName` stored at staging (`Type.Optional` in E/bridges/commands/command-record.ts), and `storedClaudeName` (E/orchestrators/skill-alias-state.ts:188), skipped when the frontmatter sets `name` (WR-01, `aliases.feature:147`). D-PG11-01 is confirmed. |
| 4 | SC4: the alias scenarios in `features/skill/aliases.feature` and `features/slash-command/aliases.feature` assert the description column: each alias suggestion shows its target's description and, for a skill, its `argument-hint` (PG-SKILL-11). | ✓ VERIFIED | `skill/aliases.feature:238` (`demo:fancy`, `<change>`, `Reviews a change.`) and `:256`; `slash-command/aliases.feature:130` (`Ships the branch.`); `slash-command/frontmatter.feature:190-196`. The step reads real pi-tui screen rows. Code unchanged: `menuDescription` (E/edge/skill-aliases.ts:41) and `menuText` (skill-alias-state.ts:244). |
| 5 | SC5 (PG-DOC-01): `docs/skills-commands-compatibility.md` covers the dropped fields, `!` injection, `run_plugin_command`, the skill-read fill, and the name mapping, and each row of its status table cites a scenario that passes. | ✓ VERIFIED | 183 lines. Sections: Name mapping (:9), Alias suggestions (:23), Typed arguments and variables (:31), Context commands (:44), File mentions (:50), Frontmatter fields (:88), The model's command tool (:99), The skill-read fill (:105), Status (:111), Not proven by a scenario (:153), Deferred (:168). Citation check re-run here, because `invocation.feature` lines moved: 0 bad, 129 distinct citations (133 total), and all 35 status rows cite at least one `features/<dir>/<file>.feature:<line>` that starts a `Scenario` or `Scenario Outline`. The two rows that 9e3dc68b rewrote cite `features/skill/invocation.feature:375`, `features/slash-command/invocation.feature:372`, `:397` (argument or `!` output, `✗`), and `:336` (code, `✓ attached, as Claude Code`), in file-then-line order. All cited scenarios passed in Gate G. The page states D-PG11-03 as a syntax rule (:60) and no longer lists it among the differences; "None of them is parity" (:72) now covers D-PG11-02, D-PG11-06, and the missing size notice. |
| 6 | SC5 (PG-DOC-02): the eight statements that the PRD's section 10 marks "none" are corrected, and a claim only a spike can settle is marked unmeasured. | ✓ VERIFIED | The eight targets were re-read in place. `docs/research/claude-hooks-vs-pi-events.md`, `docs/prd/pi-claude-marketplace-prd.md`, `E/domain/mcp-resolution.ts`, `E/bridges/mcp/builtin-overrides.ts`, `E/domain/components/hooks/builtin-mcp-tool-names.ts`, and `features/mcp-server/sources.feature` did not change since the previous report. `docs/mcp-compatibility.md` changed for other work (b5692689: pi-subagents 0.88.0 to 0.88.1 in three places; 6826f6f6: a new D-PG10-25 section), and `docs/env-vars.md` gained one D-PG10-25 sentence. Neither touched a PG-DOC-02 correction: the `tool_search` row with the codemode reach marked unmeasured, the bundle reason, the Pi 1.5.0 proof paths, and the `PATH` rows ("read in its binary and not run", D-PG11-10) are all still in place. |

**Score:** 6/6 truths (6 verified, 0 by override, 0 present but behavior-unverified).

The previous report's truth 7 (the 11-03 mask truth, by override) is not a must-have any more: see "Superseded plan truths".

### Superseded plan truths

The maintainer review of 2026-11-16 changed the contract that these plan truths were written for. ROADMAP criterion 2, REQUIREMENTS PG-SKILL-01, and the PROJECT.md rows are the contract now, and the plan files were not rewritten. Each truth below is checked against the amended contract. None of them is a failure.

| Plan truth | Superseded part | What holds on the tree |
| --- | --- | --- |
| 11-03 #2: a mention inside fenced code or a code span is not returned | the code half (D-PG11-03 reversed) | The `!` half holds: an inline `!` span and a ```` ```! ```` fence give `[]` (probe above; unit rows `D-PG11-02: reads no mention from...`). An indented block is read like any text. |
| 11-03 #9: the module imports nothing outside `shared/` | the import clause | `file-mentions.ts` now imports `./context-injection.ts` (:27) to drop `!` command text, which the amended D-PG11-03 row requires. That module has no imports and starts no process. The purity of D-PG11-08 holds: the module reads no file and starts no process. Its rules are linear scans (`indexOf` loops and the existing `!` pattern of D-CF1-02). fallow's boundaries passed in Gate G. |
| 11-03 #10: the owner test covers both fence kinds and code spans | the fence-kind rule (Markdown is no longer read) | The test covers fences and code spans as attached, at 100% direct coverage (Gate G). |
| 11-04 #3: a mention in fenced code, a code span, or a `!` command's text or output is not attached | the code half | The `!` half holds at `invocation.feature:397`. |
| 11-07 #1: each D-PG11 row has the words "pending maintainer review" | replaced by the maintainer's answers | The rows read "Locked (maintainer review 2026-11-16, confirmed)" (01, 02) and "Reversed 2026-11-16 (maintainer)" (03). Premise, versions, and license are kept. |
| 11-07 #2: the D-PG11-03 row calls the code skip a divergence | reversed | The row records the original choice, the reversal, and the read-not-run premise (binary, S8 Q1). |
| 11-08 #3: the page states D-PG11-03 (code skipped) as a difference | reversed | The page states D-PG11-02 and the D-PG11-06 directory rule as differences, and D-PG11-03 as a syntax rule that matches upstream (:60, :133). |

### Plan truths (83, re-read)

| Plan | Truths | Result | Notes |
|------|--------|--------|-------|
| 11-01 | 12 | hold | Name and alias code unchanged; `aliases.feature:41`, `:147`; owner suites pass. README line 114 of both files still states the alias and the WR-01 rule (the only README change since then is the `--map-model` line). |
| 11-02 | 10 | hold | Menu code unchanged; `skill/aliases.feature:238`, `:256`. |
| 11-03 | 10 | 7 hold, 3 superseded in part | See the table above. #1 (syntax), #3 to #8 (tokens, order, placeholders, block, line cut, append) hold; the unit rows passed here. |
| 11-04 | 12 | 11 hold, 1 superseded in part | #11: `grep -c file-mentions .fallowrc.json` prints 0. #9: the skip debug line names the path and the cause only (E/orchestrators/mention-attachments.ts, unchanged). #12: the remaining guard scenarios (argument, `!` command) are unchanged. |
| 11-05 | 9 | hold | `fillSkill` wiring unchanged; `skill/invocation.feature:350`, `:375`. |
| 11-06 | 12 | hold | See truth 6. |
| 11-07 | 7 | 5 hold, 2 superseded in part | #5: the CHANGELOG line now reads "A path inside code is attached, as in Claude Code; a path in the typed arguments or in the output of a `!` command is not." |
| 11-08 | 11 | 10 hold, 1 superseded in part | See truth 5. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `E/domain/file-mentions.ts` | pure mention parser, file block | ✓ VERIFIED | 213 lines; imports `shared/bom.ts` and `domain/context-injection.ts`; used by `mention-attachments.ts` |
| `E/domain/context-injection.ts` `withoutContextInjections` | `!` command text removed before the scan | ✓ VERIFIED | :170; unit test `test/domain/context-injection.test.ts:225-252` |
| `E/orchestrators/mention-attachments.ts` | stat, size, NUL, and read behind `MentionFileReader` | ✓ VERIFIED | unchanged; used by both invocation orchestrators |
| `E/orchestrators/command-invocation.ts`, `E/orchestrators/skill-invocation.ts` | wiring on the typed paths only | ✓ VERIFIED | unchanged; `expandStagedCommand` and `fillSkillRead` (:372) ask the reader for nothing |
| `E/domain/name.ts` `claudeCommandName`, command record, `staged-command.ts` | Claude Code name stored at staging | ✓ VERIFIED | :546, unchanged |
| `E/orchestrators/skill-alias-state.ts`, `E/edge/skill-aliases.ts` | alias from the stored name; menu text | ✓ VERIFIED | unchanged |
| `docs/skills-commands-compatibility.md` | compatibility page with a cited status table | ✓ VERIFIED | 183 lines, 35 cited rows |
| `.planning/PROJECT.md` rows D-PG11-01 to 03, D-141-01 amendment | records | ✓ VERIFIED | :2442-2444, with the maintainer's answers |
| `.fallowrc.json` (11-03 artifact) | the 11-03 entry lines, removed by 11-04 | expected absent | advisory 3 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| typed command | `appendMentionedFiles` | `renderCommand` after `expandContextInjections` | WIRED | `invocation.feature:336` |
| typed skill and alias | `appendMentionedFiles` | `fillSkill`, blocks inside `skillBlock` | WIRED | `skill/invocation.feature:350` |
| `findFileMentions` | `withoutContextInjections` | scan of the body with `!` patterns removed | WIRED | file-mentions.ts:27, :141; `invocation.feature:397` |
| staging | alias table | `claudeName` in the record, then `storedClaudeName` | WIRED | `aliases.feature:41` |
| staged frontmatter | Pi menu row | `menuText`, then `PluginAliasTarget.menu`, then `menuDescription` | WIRED | `skill/aliases.feature:238` |

`query verify.key-links`: 19/19 over the eight plans, exit 0 each.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| file block | `blocks` | real `stat` and `open` of the mentioned file (`NODE_MENTION_FILE_READER`) | yes, the fixture text reaches the scripted model | ✓ FLOWING |
| alias menu row | `target.menu` | staged frontmatter, read in the same pass as the names | yes, real pi-tui screen rows | ✓ FLOWING |
| Claude Code alias | `claudeName` | `claudeCommandName(pluginName, sourceName)` at staging | yes, `/demo:demo-lint src` reaches the model | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| owner suites of the phase | `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap` on the `file-mentions`, `context-injection`, `mention-attachments`, `command-invocation`, `skill-invocation`, `skill-alias-state`, `edge/skill-aliases`, `skill-names`, `command-record`, `staged-command`, `commands/stage`, `name`, and `typed-expansion` tests (fresh `HOME` and `PI_CODING_AGENT_DIR`) | 711 pass, 0 fail | ✓ PASS |
| amended criterion 2 at the module | `findFileMentions` on six bodies at HEAD | fence, code span, tilde fence: the mention; inline `!`, `!` fence: `[]` | ✓ PASS |
| every named scenario | Gate G log `/tmp/pg-final.log` at `333784b7` | adapter 2100/2100, builtin 204/204, `exit=0` | ✓ PASS (artifact read, not re-run, per dispatch) |
| citation check (PG-DOC-01) | each cited `features/...:<line>` must start a `Scenario`; each status row must cite one | 0 bad; 129 distinct, 133 total; 35/35 rows cite | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED. No plan or summary declares a `probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PG-SKILL-01 | 11-03, 11-04, 11-05, 11-07 | attach the `@path` mentions the author wrote that name existing regular text files; not from arguments or `!` output; attached inside code, as in Claude Code (amended 2026-11-16) | ✓ SATISFIED | Truths 1, 2 |
| PG-CMD-09 | 11-01, 11-07 | a command also answers to `/<plugin>:<path>:<file>` | ✓ SATISFIED (D-PG11-01 confirmed) | Truth 3 |
| PG-SKILL-11 | 11-02, 11-07 | an alias suggestion shows the target's description and a skill's `argument-hint` | ✓ SATISFIED | Truth 4 |
| PG-DOC-01 | 11-08 | compatibility page; each status row cites its scenario | ✓ SATISFIED | Truth 5 |
| PG-DOC-02 | 11-06 | the eight "none" statements corrected; spike-only claims marked unmeasured | ✓ SATISFIED | Truth 6 |

No orphaned requirements: REQUIREMENTS.md maps exactly these five IDs to Phase 11 (:209-211, :215-216), each is in a plan's `requirements`, and each is `[x]` and Complete.

### Prohibitions (judgment tier)

All 14 prohibitions in the plans are `verification: judgment`; none is test-tier. This is a non-authoritative LLM-judge verdict: no violation found. The D-PG11-03 clauses are superseded, because the maintainer settled D-PG11-03 as parity. The rest were re-read. The page's list of differences (:72-76) calls D-PG11-02 and the D-PG11-06 rule "None of them is parity". No added line of c6812df5 or 9e3dc68b calls D-PG11-02 or D-PG11-06 parity, and the CHANGELOG line names the code rule only as "as in Claude Code". No text says that command names now match Claude Code's, or that a skill's `argument-hint` shows everywhere. The skip debug line names the path and the cause only. The D-PG11-03 row says the premise was "read in the binary, not run". Flag: **unverified-prohibition, human review recommended** (maintainer_review).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| c6812df5 files (`file-mentions.ts`, `context-injection.ts`, their tests, `invocation.feature`) and the page | - | TBD / FIXME / XXX / TODO / HACK, skipped or focused tests | none found | - |
| `11-CONTEXT.md` | :8-12, :48, :100, :251-259 | D-PG11-01, -02, and -06 still called pending maintainer review | ℹ️ Info (records) | advisory 1 |
| `11-SECURITY.md` | :41 | T-11-06 mitigation still names the removed masks | ℹ️ Info (records) | advisory 2 |
| `ROADMAP.md` plan list | 11-03, 11-04 lines | the plan descriptions still say "with code masked" and "guards for a path ... from code" | ℹ️ Info | historical plan titles; criterion 2 above them is amended |
| `E/domain/file-mentions.ts` `renderMentionBlock` | - | IN-01 (an empty file attaches an empty block), IN-02 (`#L5-3` or `#L0` attach an empty block) | ℹ️ Info | unchanged; no criterion covers them |
| `E/orchestrators/skill-invocation.ts` | - | IN-03: an attached `</skill>` line followed by a blank line splits Pi's display of the skill block | ℹ️ Info | unchanged; display only |
| `E/domain/file-mentions.ts` | - | IN-04: repeats are removed by text, so `@a.md` and `@./a.md` attach twice | ℹ️ Info | as 11-03 truth 4 specifies |
| `E/domain/name.ts`, `E/bridges/commands/discover.ts` | - | IN-05: a manifest map key `tools/lint` gets the stored name `plugin:tools:lint` (upstream unverified) | ℹ️ Info | unchanged |
| `E/bridges/skills/skill-names.ts` | - | IN-08: `commandUpstreamNames` ignores a frontmatter `name`; the upstream conflict rule is unverified | ℹ️ Info | unchanged |

### Human Verification Required

None for shipped behavior. The attachments are proven on a scripted model's real input, and the menu text on real pi-tui screens. The maintainer answered every D-PG11 decision on 2026-11-16, so no decision is open. The one open review point is the 14 judgment-tier prohibitions (maintainer_review).

### Gaps Summary

No gaps and no regression. The maintainer reversed D-PG11-03, and the tree follows the reversal: the mask is gone, a mention inside fenced code or a code span is attached (`invocation.feature:368-370`), and a mention in a `!` command's text or output is still not attached (`:397`). The override that carried the mask's CommonMark gaps is removed, because the must-have it covered no longer exists. It is not recorded as accepted by the maintainer. Criteria 1 and 3 rest on D-PG11-02 and D-PG11-01, which the maintainer confirmed. Three advisories remain, all records: 11-CONTEXT.md still calls D-PG11-01, -02, and -06 pending; 11-SECURITY.md T-11-06 names the removed masks; and the expected 11-03 artifact probe failure.

---

_Verified: 2026-11-17T01:58:40Z_
_Verifier: Claude (gsd-verifier)_
