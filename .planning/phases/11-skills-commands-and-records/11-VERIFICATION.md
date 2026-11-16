---
phase: 11-skills-commands-and-records
verified: 2026-11-16T08:12:30Z
status: passed
score: "7/7 must-haves verified (6 verified, 1 passed by override: the two remaining CommonMark gaps of the D-PG11-03 code mask, carried to maintainer review); 83 plan truths re-read, none failed; 14 judgment-tier prohibitions flagged"
covered_files: [".planning/phases/11-skills-commands-and-records/11-01-PLAN.md",".planning/phases/11-skills-commands-and-records/11-01-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-02-PLAN.md",".planning/phases/11-skills-commands-and-records/11-02-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-03-PLAN.md",".planning/phases/11-skills-commands-and-records/11-03-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-04-PLAN.md",".planning/phases/11-skills-commands-and-records/11-04-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-05-PLAN.md",".planning/phases/11-skills-commands-and-records/11-05-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-06-PLAN.md",".planning/phases/11-skills-commands-and-records/11-06-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-07-PLAN.md",".planning/phases/11-skills-commands-and-records/11-07-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-08-PLAN.md",".planning/phases/11-skills-commands-and-records/11-08-SUMMARY.md","CHANGELOG.md","README.es.md","README.md","docs/env-vars.md","docs/mcp-compatibility.md","docs/prd/parity-gaps-prd.md","docs/prd/pi-claude-marketplace-prd.md","docs/research/claude-hooks-vs-pi-events.md","docs/skills-commands-compatibility.md","extensions/pi-claude-marketplace/bridges/commands/command-record.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts","extensions/pi-claude-marketplace/bridges/skills/skill-names.ts","extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts","extensions/pi-claude-marketplace/domain/file-mentions.ts","extensions/pi-claude-marketplace/domain/mcp-resolution.ts","extensions/pi-claude-marketplace/domain/name.ts","extensions/pi-claude-marketplace/edge/skill-aliases.ts","extensions/pi-claude-marketplace/orchestrators/command-invocation.ts","extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts","extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts","extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts","features/mcp-server/sources.feature","features/skill/aliases.feature","features/skill/invocation.feature","features/slash-command/aliases.feature","features/slash-command/frontmatter.feature","features/slash-command/invocation.feature","test/bridges/commands/command-record.test.ts","test/bridges/commands/stage.test.ts","test/bridges/commands/staged-command.test.ts","test/bridges/skills/skill-names.test.ts","test/domain/file-mentions.test.ts","test/domain/name.test.ts","test/edge/skill-aliases.test.ts","test/orchestrators/command-invocation.test.ts","test/orchestrators/mention-attachments.test.ts","test/orchestrators/skill-alias-state.test.ts","test/orchestrators/skill-invocation.test.ts","test/orchestrators/typed-expansion.test.ts"]
covered_digest: "v4:sha256:6348f4c274711254e409df3f9f38dfa6bdba49b9e519a91c69603c8c7cfd7a7e"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "11-03 truth: a mention inside fenced code, with a backtick or a tilde fence, closed or not, or inside a code span is not returned, in every Markdown shape (CommonMark agreement of the D-PG11-03 mask)."
    reason: "Revised 2026-11-16 after 1183aae3. The mask now reads each line's blockquotes and list items through one container model, as CommonMark does (domain/file-mentions.ts:22-29, lineRole :380, maskCode :474). The four iteration-3 residuals that this override used to carry are closed and pinned in test/domain/file-mentions.test.ts: IN-09 (`> Note `x\\n>\\t- @b.md `y` gives [b.md], :383-386), the list half of IN-11 (`1. Step:\\n\\n    ```\\n    see @b.md\\n\\n    more\\n    ``` ` gives [], :230-232), the list residual (`- a `x\\n    2. @b.md `y` gives [], :389-391), and the WR-05 empty-item body (`> -\\nfoo `a\\n> @b.md `y` gives [b.md], :394-396). I reproduced each at HEAD, and each gave the opposite result on the module of 5fd2706a. The truth still does not hold as written in two shapes, both stated in the module header and on docs/skills-commands-compatibility.md:74. (a) An HTML block is read as a paragraph. A code span in it is masked (`<div>\\n`a @b.md`\\n</div>` gives [], where CommonMark reads raw HTML). A fence line in it also opens a fence, which the header and the page do not say: `<div>\\n```\\n</div>\\n\\n```\\n@b.md\\n``` ` gives [b.md], a mention that CommonMark puts in fenced code (marked 18.0.11 lexer: html, space, code), and `<div>\\n```\\n</div>\\n\\n@b.md` gives [], where CommonMark reads a paragraph. The module of 5fd2706a gave the same three results, so this is not a regression (advisory 2). No test pins the HTML-block behavior. (b) A line opens at most 100 containers (MAX_CONTAINERS, :105), so a deeper marker is text. Pinned at :254-258: 101 quote markers and a fence, then 101 markers and `@a.md`, gives [a.md], where CommonMark (marked: 101 blockquotes around a code block) puts the mention in fenced code. The bound keeps the scan linear (11-03 truth 9). An override is still needed: shape (b) and the fence half of shape (a) return a mention that is inside fenced code, which the truth forbids. D-PG11-03 is pending maintainer review. If the maintainer follows Claude Code and drops the mask, both gaps go away. If the skip stays, the maintainer decides whether these two gaps are acceptable. Not a fix-it-instead case: both shapes are rare, the criterion 2 shapes (fence, code span, `!` command) all pass, and attaching a mention is what Claude Code does for every mention."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-16T05:21:52Z"
re_verification:
  previous_status: passed
  previous_score: "7/7 (6 verified, 1 passed by override: the documented CommonMark residual of the D-PG11-03 code mask)"
  previous_verified: 2026-11-16T05:21:52Z
  reason: "staleness: covered files changed after the previous report (ceb1e3a1). Over its 40 covered non-planning files, `git diff --stat ceb1e3a1 HEAD` shows 4 changed, all by 1183aae3 (`fix(skills): read mention code blocks through one container model`, the post-close review PC-1 to PC-5 of 11-REVIEW-FIX.md): extensions/pi-claude-marketplace/domain/file-mentions.ts (+496/-, the mask rewritten), test/domain/file-mentions.test.ts (+19 rows, 115 to 134), features/slash-command/invocation.feature (+4 Outline rows), and docs/skills-commands-compatibility.md (the D-PG11-03 bullet rewritten, two citations moved). No phase 11 PLAN or SUMMARY changed. 1183aae3 also moved two citations in this report (invocation.feature :374 to :377, :399 to :402)."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  overrides_kept: []
  overrides_changed:
    - "11-03 truth (CommonMark agreement of the D-PG11-03 mask): the reason no longer carries the iteration-3 residuals (IN-09, the list half of IN-11, the list residual), which 1183aae3 closed. It now carries only (a) the HTML block read as a paragraph, including its fence half, which the docs do not state, and (b) the 100-container bound. The must_have text and accepted_by are unchanged. The truth still does not hold as written, so the override stays."
  overrides_added: []
  overrides_removed: []
  warnings_closed:
    - "The previous docs warning (README.md:114 and README.es.md:114 omitted the WR-01 frontmatter-name rule) was fixed in 29661a49 and holds at HEAD: line 114 of both READMEs says that the command answers to its path-based name when its frontmatter does not set `name`."
  records_correction: "The previous report said that REQUIREMENTS.md showed the five phase IDs as Pending. They are now `[x]` at REQUIREMENTS.md:74-76 and :86-87, and Complete at :209-211 and :215-216."
advisory:
  - finding: "11-CONTEXT.md D-PG11-03 (:116-138) still describes the iteration-3 residuals: 'inside a list the bridge does not track where an item's text starts', a fence indented four columns or more in a list item is not recognized, and 'A tab after `>` counts as four columns'. 1183aae3 closed all three. The record does not name the two gaps that remain (HTML block, 100-container bound). .planning/PROJECT.md:2443 (D-PG11-03) names no residual and needs no change."
    category: other
    reason: "Records only. The decision record belongs to the maintainer, so this pass did not edit it (as 11-REVIEW-FIX.md 'Residuals (post-close)' also notes). To resolve: when the maintainer answers D-PG11-03, replace the Residual sentences with the two remaining gaps, or drop them if the mask goes."
    evidence_status: "reproducible: `sed -n 132,138p .planning/phases/11-skills-commands-and-records/11-CONTEXT.md`"
  - finding: "The HTML-block gap is stated narrower than it is. The module header (domain/file-mentions.ts:27-29) and the page (docs/skills-commands-compatibility.md:74) say only that a code span inside an HTML block is masked. Because the block is read as a paragraph, a fence line inside it opens a fence. A mention after the block can then be skipped (`<div>\\n```\\n</div>\\n\\n@b.md` gives []), and a mention inside a real fence after the block can be attached (`<div>\\n```\\n</div>\\n\\n```\\n@b.md\\n``` ` gives [b.md]; also with an HTML comment, `<!--\\n```\\n-->`). marked 18.0.11's lexer reads the first as html then a paragraph, and the second as html then a code block. The module of 5fd2706a gives the same results, so this is not a regression, and 1183aae3's claim that the header and the page state the HTML-block rule is true for the rule itself but not for this effect."
    category: other
    reason: "A doc accuracy point, not a must-have failure. The override reason above carries the behavior. To resolve: if the mask stays, widen the header and page sentence to say that a fence line inside an HTML block can also skip or attach a later mention, and add a pin. Or treat HTML blocks as CommonMark does."
    evidence_status: "reproducible: `findFileMentions` on the two bodies above at HEAD and at 5fd2706a (scratchpad probe, not committed)"
  - finding: "The 11-03 artifact probe `.fallowrc.json contains: domain/file-mentions.ts` fails (`query verify.artifacts` 2/3, exit 1). This is expected: the artifact describes 'the entry and ignoreExports lines that plan 11-04 removes', and 11-04 truth 11 requires them gone. `grep -c file-mentions .fallowrc.json` prints 0, and fallow passed in Gate G."
    category: other
    reason: "A probe that a later plan in the same phase meant to fail, not a must-have. No action needed. The previous report did not run the artifact probe."
    evidence_status: "reproducible by `query verify.artifacts .planning/phases/11-skills-commands-and-records/11-03-PLAN.md`"
prohibitions_flagged: 14
prohibition_review: "NON-AUTHORITATIVE; unverified-prohibition, human review recommended. The 14 judgment-tier prohibitions of plans 11-01 to 11-08 (1, 1, 1, 2, 1, 2, 2, 4; none test-tier) were re-read against the current tree, and no violation was found (see the Prohibitions section). As in the Phase 4/6/7/9/10 re-verifications, they are listed under maintainer_review and not as manual tests."
# The items below are maintainer review points carried out of the phase; none is a test of shipped behavior.
maintainer_review:
  - test: "D-PG11-01 (PRD decision 13, amends D-141-01): read the row in .planning/PROJECT.md:2441 and confirm that a bridged command also answers to Claude Code's name for it, `/<plugin>:<path>:<file>`, while the listed name keeps the D-141-01 elision."
    expected: "Confirmed: the row stops saying 'Pending maintainer review' and PG-CMD-09 stands. A 'no' moves PG-CMD-09 to Out of Scope (ROADMAP Phase 11 discuss step), removes the stored `claudeName` alias source, and success criterion 3 must be amended."
    why_human: "The ROADMAP says decision 13 comes first and a 'no' descopes PG-CMD-09. An autonomous discussion answered it; only the maintainer can confirm."
  - test: "D-PG11-02 (PROJECT.md:2442): confirm that only the @ mentions the author wrote are attached, a divergence from Claude Code 2.1.323 licensed by Pi's missing Read permission gate."
    expected: "Confirmed: success criterion 1 stands as verified. Reversed: the scan input becomes the rendered text, and criterion 1 (`/demo:review @/etc/hostname` attaches nothing) must be amended."
    why_human: "Criterion 1 passes because of this recorded divergence, which is pending maintainer review."
  - test: "D-PG11-03 (PROJECT.md:2443, 11-CONTEXT.md): keep the skip of mentions inside code, or follow Claude Code and change success criterion 2. If the skip stays, accept or reject the two CommonMark gaps that remain after 1183aae3 (the override above): (a) an HTML block is read as a paragraph, so a code span in it is masked, and a fence line in it opens a fence that can skip a later mention or attach one inside a real fence after the block (the second effect is not in the docs, advisory 2); (b) a line opens at most 100 containers, so a deeper marker is text (pinned at test/domain/file-mentions.test.ts:254-258). IN-09, the list half of IN-11, the list residual, and the WR-05 empty-item body are closed and pinned. When answering, also update the Residual text of D-PG11-03 in 11-CONTEXT.md, which still describes the iteration-3 residuals (advisory 1)."
    expected: "Keep: criterion 2 stands, the two gaps are accepted or reopened as a new item, and the page and header are widened for the HTML fence effect. Follow upstream: the mask is dropped, criterion 2 is amended, and both gaps disappear."
    why_human: "A divergence with no Pi gap behind it, licensed by the recorded decision alone and pending maintainer review."
  - test: "D-PG11-06 (11-CONTEXT.md, listed there as pending maintainer review): a directory mention is not attached, where Claude Code attaches an `ls` listing. This decision has no Key Decisions row in PROJECT.md (D-PG11-14 asked only for rows 01 to 03)."
    expected: "Confirmed or sent back; if it is to stay a recorded divergence, it gets a PROJECT.md row."
    why_human: "A recorded policy choice pending maintainer review; the code matches it as written (orchestrators/mention-attachments.ts:95, 'it is not a regular file')."
  - test: "Judgment-tier prohibitions of plans 11-01 to 11-08 (14 items, all verification: judgment, none test-tier)."
    expected: "No comment, title, README, CHANGELOG, record, or doc calls D-PG11-02, D-PG11-03, or the D-PG11-06 directory rule parity; no text says command names now match Claude Code's; no text says a skill's argument-hint shows everywhere; no file content reaches a debug line; no corrected claim read but not run is stated as measured; no dated audit or BACKLOG entry was rewritten or closed."
    why_human: "The verifier's check is an LLM judgment, not authoritative (see the Prohibitions section). Human review recommended."
human_verification: []
---

# Phase 11: Skills, Commands, and Records Verification Report

**Phase Goal:** A typed plugin command or skill attaches the files its author referenced, a command answers to the name Claude Code gives it, and alias suggestions show what their target does. Skills and commands get a compatibility page whose every row cites its proof, and the records that no requirement owns are corrected.
**Verified:** 2026-11-16T08:12:30Z
**Status:** passed, with one override (the two remaining CommonMark gaps of the D-PG11-03 mask, pending maintainer review), 14 flagged judgment-tier prohibitions, and 3 advisories (records and docs only). All five roadmap criteria hold on the current tree.
**Re-verification:** Yes. The previous report (passed, 7/7, one override, commit ceb1e3a1) became stale because 1183aae3 changed 4 of its 40 covered non-planning files.

## Verification Basis

This pass re-checked every roadmap criterion and the 83 plan truths of the eight plans against the current tree, `features/gaps` at `9cf82536`. It did not reuse the earlier verdicts, and summaries and 11-REVIEW-FIX.md were not taken as evidence. Every closed or remaining residual named below was run again here with `findFileMentions` at HEAD and at `5fd2706a`, and two of them were checked against a CommonMark lexer (`marked` 18.0.11, from `node_modules`). The 11-03 truths were re-checked in full, because `domain/file-mentions.ts` changed. For the other plans, their files did not change since the previous report. I re-read each truth against its code and its named test or scenario, and the owner suites passed again here. **E/** means `extensions/pi-claude-marketplace/`.

What moved since the previous report: `E/domain/file-mentions.ts` grew from 530 to 626 lines. The mask helpers `maskFences` and `paragraphs()` are gone. The new pieces are `blockLine` (:164, tabs to the next multiple of four), `continuation` (:191), `openContainers` (:281), `leafRole` (:345), `lineRole` (:380), and `maskCode` (:474), plus `MAX_CONTAINERS` (:105). `findFileMentions` is now :553. `test/domain/file-mentions.test.ts` holds 134 rows, up from 115. In `features/slash-command/invocation.feature`, the attach Outline (:336) has 9 rows (3 new, :373-375), the argument scenario moved from :374 to :377, and the not-attached Outline moved from :399 to :402 with 5 rows (1 new, :437). On the page, the D-PG11-03 bullet (:74) was rewritten, and the status rows cite :377 and :402. No other covered file changed. The cited lines of the command and skill orchestrators, `domain/name.ts`, the alias state and menu code, the READMEs, and PROJECT.md were re-read in place.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`). The log names no commit. Its mtime, 01:22, falls after 1183aae3 (01:07) and before f48729e3 (01:23), and f48729e3 changes planning files only. The verifier read the log. All seven static checks passed: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features. The unpaired and integration tests passed with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`, on Node v26.13.1. The adapter cucumber profile ran 2098/2098 scenarios and 25964/25964 steps (seed 700460). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 547387). Direct coverage merged 374 LCOV records, and the log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD. The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass):** the eleven owner suites of the phase ran under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad, with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap`: 738/738 pass, which is the earlier 719 plus the 19 new rows. `test/domain/file-mentions.test.ts` alone gave 134/134. `query verify.key-links` gives the full count for all eight plans (19/19 links), and `query verify.artifacts` gives the full count for seven plans and 2/3 for 11-03 (advisory 3). No real `~/.pi/agent` or HOME config file was read.

## Superseded mechanisms (later work)

| Change | What it changed | Effect on Phase 11 must-haves |
| --- | --- | --- |
| 1183aae3, post-close review PC-1 to PC-5 (11-REVIEW-FIX.md), under D-PG11-03 | One container model (`lineRole`, E/domain/file-mentions.ts:380) replaces the fence pass and the paragraph pass, which each kept their own model of blockquotes and list items. It tracks an item's content column, tab stops, and lazy continuation lines, and a line opens at most 100 containers (:105). The code span algorithm is unchanged. | Truth 2 holds with 5 not-attached rows instead of 4. Truth 7: the four iteration-3 residuals are closed and pinned, and the override now carries only the HTML block and the 100-container bound. The page's D-PG11-03 bullet describes the new model (:74). No other truth is affected. |
| 29661a49 (before the previous report's fingerprint) | README line 114 states the WR-01 frontmatter-name rule. | Closes the previous docs warning. |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: a command body `Review @${CLAUDE_PLUGIN_ROOT}/templates/x.md` reaches the scripted model with the template text in a `<file>` block. `/demo:review @<path>` gives the model the argument as text with no `<file>` block (PG-SKILL-01). | ✓ VERIFIED | `features/slash-command/invocation.feature:336` row `as plain text` (:367): the model gets `Review @{home}/.../templates/x.md\n\n<file name="{home}/.../templates/x.md">\nCheck the spelling.\n</file>`. `:377`: body `Review $ARGUMENTS`, the user types `/demo:review @{home}/.../templates/x.md`, which names an existing file, and the model gets the text only (:400). The scenario uses a fixture file instead of `/etc/hostname`, as D-PG11-13 allows; an existing file makes the guard stronger. Skill side: `features/skill/invocation.feature:350` (typed alias, block inside `</skill>`), `:375` (argument not attached). Code: `renderCommand` (E/orchestrators/command-invocation.ts:216-246) builds `authored` with `args: undefined` (:222-227) and passes it to `appendMentionedFiles` (:242) after `expandContextInjections` (:239). `fillSkill` (E/orchestrators/skill-invocation.ts:192-228) does the same (:200, :216, :224). With `args` undefined, `substituteArguments` fills variables only (E/domain/argument-substitution.ts:243-245). |
| 2 | SC2: a `@path` inside fenced code or a code span, or in the output of an injected `!` command, is not attached (PG-SKILL-01). | ✓ VERIFIED | `invocation.feature:402` rows `in fenced code` (:433), `in a code span` (:434), `in a context command and its output` (:435; the model gets `Shown: @{home}/.../x.md`, the `!` output, with no block), `in a code span over an unindented === line in a list` (:436), and, new in 1183aae3, `in a fence on a list item in a blockquote` (:437). The `!` row would fail under a scan of the rendered text, since the output is plain text after expansion. The code scans `authored`, which never holds `!` output. `findFileMentions` (E/domain/file-mentions.ts:553) scans `maskCode(body)` (:474), which blanks fenced runs and the content of each paragraph's code spans. Unit: `test/domain/file-mentions.test.ts` 134/134 here. The two rare shapes where the mask still returns a mention from inside code are truth 7. |
| 3 | SC3: with `demo/commands/demo-lint.md`, `/demo:demo-lint x` sends the command body, as `/demo:lint x` does (PG-CMD-09). | ✓ VERIFIED | `features/slash-command/aliases.feature:41` Outline rows `/demo:lint`, `/demo:demo-lint`, and `/demo:demo-tools:lint`, each `Lint the sources.\n\nARGUMENTS: src`. Code: `claudeCommandName` (E/domain/name.ts:546) joins plugin and path segments with `:` and elides nothing. `staged-command.ts` stores the result as `claudeName` in the install record (schema `Type.Optional`, E/bridges/commands/command-record.ts:36, so an old record still reads). `storedClaudeName` (E/orchestrators/skill-alias-state.ts:188) adds it unless `declaresFrontmatterName` (:192, WR-01), under the plugin's own prefix, with no whitespace. The existing `claimedAliases` and reserved-name rules apply. `aliases.feature:147` proves the frontmatter-name case (`/demo:demo-ship` is plain text). |
| 4 | SC4: the alias scenarios in `features/skill/aliases.feature` and `features/slash-command/aliases.feature` assert the description column: each alias suggestion shows its target's description and, for a skill, its `argument-hint` (PG-SKILL-11). | ✓ VERIFIED | `skill/aliases.feature:238` (`demo:fancy` / `<change>` / `Reviews a change.`) and `:256` (`[change]` shows `change`); `slash-command/aliases.feature:130` (`Ships the branch.`, which was empty before); `slash-command/frontmatter.feature:190-196`, row `demo:demo-skill`, now `A skill of demo 1.0.0.`. The step (`features/step_definitions/slash-command/frontmatter.steps.ts:147`) reads real pi-tui screen rows and splits hint and description. Code: `menuDescription` (E/edge/skill-aliases.ts:41) builds `hint — description` as pi-tui 1.5.0 does. `menuText` (E/orchestrators/skill-alias-state.ts:244) reads the staged `description` and `argument-hint`. |
| 5 | SC5 (PG-DOC-01): `docs/skills-commands-compatibility.md` covers the dropped fields, `!` injection, `run_plugin_command`, the skill-read fill, and the name mapping, and each row of its status table cites a scenario that passes. | ✓ VERIFIED | Sections (183 lines): Name mapping (:9), Alias suggestions (:23), Typed arguments and variables (:31), Context commands (:44), File mentions (:50; D-PG11-02, -03, -06 stated as differences, "None of them is parity", :71), Frontmatter fields (:88), The model's command tool (:99), The skill-read fill (:105), Status (:111), Not proven by a scenario (:153), Deferred (:168). Citation check re-run here: 0 `BAD`, 129 distinct citations (133 total), and every one of the 35 status rows cites at least one `features/<dir>/<file>.feature:<line>`. Each cited line starts a `Scenario` or `Scenario Outline`. The two rows that 1183aae3 moved now cite `features/slash-command/invocation.feature:377` and `:402`, in ascending order after `features/skill/invocation.feature:375` (11-08 truth 9). All cited scenarios passed in Gate G. Both READMEs link the page (`README.md:125`, `README.es.md:125`). |
| 6 | SC5 (PG-DOC-02): the eight statements that the PRD's section 10 marks "none" are corrected, and a claim only a spike can settle is marked unmeasured. | ✓ VERIFIED | None of the eight targets changed since the previous report (`docs/research/claude-hooks-vs-pi-events.md`, `docs/mcp-compatibility.md`, `docs/env-vars.md`, `docs/prd/pi-claude-marketplace-prd.md`, `E/domain/mcp-resolution.ts`, `E/bridges/mcp/builtin-overrides.ts`, `E/domain/components/hooks/builtin-mcp-tool-names.ts`, `features/mcp-server/sources.feature`; `git diff ceb1e3a1 HEAD` is empty for them and for `.planning/BACKLOG.md` and `.planning/PROJECT.md`). Re-read in place: (1) the event-count amendment (41 events in Pi 1.5.0 and 1.5.2); (2) nine first-party events, with `claude-security` using `PermissionRequest`, which is unsupported; (3) the `tool_search` row and divergence bullet, and BACKLOG TOOLSEARCHOFF-01, with the codemode reach marked "Unmeasured"; (4) the bundle reason (`sources.feature:405` description, the `mcp-resolution.ts` comment, BACKLOG MCPB-01): Claude Code has no runner either; (5) the proof paths, right for Pi 1.5.0 and moved to `@earendil-works/pi-mcp` in 1.5.1; (6) the `env-vars.md` `PATH` rows, "read in its binary and not run", D-PG11-10; (7) the BACKLOG WOUT-01 heading, and UAT-02 marked unmeasured; (8) PRD section 3 "Component": hooks supported in part, workflows supported. |
| 7 | 11-03 truth: a mention inside fenced code (closed or not) or a code span is not returned, in every Markdown shape. | PASSED (override), carried to maintainer review; see `overrides` | After 1183aae3 the mask reads blockquotes and list items as CommonMark does (E/domain/file-mentions.ts:22-29). The iteration-3 residuals now match CommonMark, each reproduced here, with the opposite result at `5fd2706a`: IN-09 `> Note `x\n>\t- @b.md `y` gives `[b.md]` (pin :383-386); its tab variant `>\tUse `x\n#tag @b.md `y` gives `[]`, a lazy line inside the span (not pinned by that body); the list half of IN-11 gives `[]` (:230-232); the list residual `- a `x\n    2. @b.md `y` gives `[]` (:389-391); and the WR-05 empty-item body gives `[b.md]` (:394-396). Two shapes remain, both stated in the header and on the page (:74). (a) An HTML block is read as a paragraph. `<div>\n`a @b.md`\n</div>` gives `[]` (no pin). A fence line in the block also opens a fence, so `<div>\n```\n</div>\n\n```\n@b.md\n```` gives `[b.md]`, which CommonMark puts in fenced code. This effect is not in the docs (advisory 2). (b) A line opens at most 100 containers (:105). The pin at :254-258 returns `[a.md]` from a fence nested 101 blockquotes deep, and `marked` reads that body as code inside 101 blockquotes. Both return a mention from inside fenced code, so the truth does not hold as written, and the override stays. |

**Score:** 7/7 truths (6 verified, 1 passed by override; 0 present, behavior-unverified).

### Plan truths (83, re-read)

| Plan | Truths | Result | Notes |
|------|--------|--------|-------|
| 11-01 | 12 | hold | Name and alias code unchanged; `aliases.feature:41`, `:147`; owner suites `name`, `staged-command`, `command-record`, `commands/stage`, `skill-alias-state` pass. Truth 11: README line 114 of both files states the alias and the WR-01 rule. |
| 11-02 | 10 | hold | Menu code unchanged; `skill/aliases.feature:238`, `:256`; `edge/skill-aliases` suite passes. |
| 11-03 | 10 | 9 hold, 1 by override | Truth 2 is truth 7 above. Truth 9: `findFileMentions` imports only `shared/bom.ts` (:31), the mask is one pass over the lines, and the 100-container bound keeps it linear. Truth 10: 134 rows, read no file. |
| 11-04 | 12 | hold | Truth 3 rests on 11-03 truth 2 (criterion shapes pass at `invocation.feature:402`). Truth 11: `grep -c file-mentions .fallowrc.json` prints 0. Truth 9: the skip debug line names the path and cause only (E/orchestrators/mention-attachments.ts:129). |
| 11-05 | 9 | hold | `fillSkill` wiring (:192-228); `skill/invocation.feature:350`, `:375`. |
| 11-06 | 12 | hold | Files unchanged since the previous report; see truth 6. |
| 11-07 | 7 | hold | PROJECT.md:2441-2443 rows, each "Pending maintainer review"; D-141-01 says "Amended by D-PG11-01". |
| 11-08 | 11 | hold | See truth 5. Truth 3: the rewritten D-PG11-03 bullet still says "Reason: project decision, with no Pi gap behind it", under "None of them is parity" (:71). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `E/domain/file-mentions.ts` | pure mention parser, code mask, file block | ✓ VERIFIED | 626 lines; imports only `shared/bom.ts`; consumed by `mention-attachments.ts` |
| `E/orchestrators/mention-attachments.ts` | stat, size, NUL, read behind `MentionFileReader` | ✓ VERIFIED | `appendMentionedFiles` (:138), used by both invocation orchestrators through the required `mentions` dependency |
| `E/orchestrators/command-invocation.ts`, `E/orchestrators/skill-invocation.ts` | wiring on the typed paths only | ✓ VERIFIED | `expandStagedCommand` and `fillSkillRead` (:372) ask the reader for nothing (owner tests `D-PG11-07: asks the mention reader for nothing...`) |
| `E/domain/name.ts` `claudeCommandName`, `E/bridges/commands/command-record.ts`, `staged-command.ts` | Claude Code name stored at staging | ✓ VERIFIED | `claudeName` optional in the schema (:36) |
| `E/orchestrators/skill-alias-state.ts`, `E/edge/skill-aliases.ts` | alias from the stored name; menu text | ✓ VERIFIED | `PluginAliasTarget.menu` required on both arms |
| `docs/skills-commands-compatibility.md` | compatibility page with cited status table | ✓ VERIFIED | 183 lines, 35 cited rows |
| `.planning/PROJECT.md` rows D-PG11-01..03, D-141-01 amendment | records | ✓ VERIFIED | `:2441-2443`, each "Pending maintainer review" |
| `.fallowrc.json` (11-03 artifact) | the 11-03 entry lines, removed by 11-04 | expected absent | advisory 3 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| typed command | `appendMentionedFiles` | `renderCommand` after `expandContextInjections` | WIRED | `invocation.feature:336` |
| typed skill and alias | `appendMentionedFiles` | `fillSkill`, blocks inside `skillBlock` | WIRED | `skill/invocation.feature:350` |
| `findFileMentions` | `maskCode` → `lineRole` | one container model for both masks | WIRED | file-mentions.ts:553-554, :474-488 |
| staging | alias table | `claudeName` in record → `storedClaudeName` → `COMMAND_KIND.names` | WIRED | `aliases.feature:41` |
| staged frontmatter | Pi menu row | `menuText` → `PluginAliasTarget.menu` → `menuDescription` | WIRED | `skill/aliases.feature:238` |

`query verify.key-links`: 19/19 over the eight plans, exit 0 each.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| file block | `blocks` | real `stat`/`open` of the mentioned file (`NODE_MENTION_FILE_READER`) | yes, the fixture text reaches the scripted model | ✓ FLOWING |
| alias menu row | `target.menu` | staged frontmatter read in the same pass as the names | yes, real pi-tui screen rows | ✓ FLOWING |
| Claude Code alias | `claudeName` | stage-time `claudeCommandName(pluginName, sourceName)` | yes, `/demo:demo-lint src` reaches the model | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| owner suites of the phase | `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap` on the `file-mentions`, `mention-attachments`, `command-invocation`, `skill-invocation`, `skill-alias-state`, `edge/skill-aliases`, `skill-names`, `command-record`, `staged-command`, `commands/stage`, and `name` tests (fresh `HOME`, `PI_CODING_AGENT_DIR`) | 738 pass, 0 fail | ✓ PASS |
| closed residuals | `findFileMentions` at HEAD and on the module of `5fd2706a` (scratchpad copy) | IN-09 `[b.md]` (was `[]`); tab variant `[]` (was `[b.md]`); IN-11 list `[]` (was `[b.md]`); list residual `[]` (was `[b.md]`); WR-05 empty item `[b.md]` (was `[]`); PC-3 `[c.md]` (was `[]`). All match CommonMark at HEAD | ✓ PASS |
| remaining gap (a) | the same probe on HTML-block bodies, at HEAD and at `5fd2706a` | span in `<div>`: `[]`; fence line in `<div>` then a paragraph: `[]`; fence line in `<div>` (or `<!--`) then a real fence: `[b.md]`. Same at both commits. `marked` 18.0.11 reads html, then a paragraph or code | documented in part (advisory 2) |
| remaining gap (b) | `marked` lexer on the :256 pin body | 101 nested blockquotes around a `code` token; the module returns `[a.md]` (pin) | carried by override |
| every named scenario | Gate G log `/tmp/pg11-maskfix.log` at `1183aae3` (no executable change since) | adapter 2098/2098, builtin 204/204, `exit=0` | ✓ PASS (artifact read, not re-run, per dispatch) |
| citation check (PG-DOC-01) | each cited `features/...:<line>` must start a `Scenario`; each status row must cite | 0 `BAD`; 129 distinct, 133 total; 35/35 rows cite | ✓ PASS |

I did not re-run the cucumber red runs or the 500,000-body differential check that 11-REVIEW-FIX.md reports. The module-level runs above cover the bodies of the four new cucumber rows' parent findings.

### Probe Execution

Step 7c: SKIPPED. No plan or summary declares a `probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PG-SKILL-01 | 11-03, 11-04, 11-05, 11-07 | attach author-written `@path` to existing regular text files; not from arguments, `!` output, or code | ✓ SATISFIED (D-PG11-02, -03 pending maintainer review; two rare-shape gaps by override) | Truths 1, 2, 7 |
| PG-CMD-09 | 11-01, 11-07 | a command also answers to `/<plugin>:<path>:<file>` | ✓ SATISFIED (D-PG11-01 pending maintainer review) | Truth 3 |
| PG-SKILL-11 | 11-02, 11-07 | alias suggestion shows the target's description and a skill's `argument-hint` | ✓ SATISFIED | Truth 4 |
| PG-DOC-01 | 11-08 | compatibility page, each status row cites its scenario | ✓ SATISFIED | Truth 5 |
| PG-DOC-02 | 11-06 | the eight "none" statements corrected; spike-only claims marked unmeasured | ✓ SATISFIED | Truth 6 |

No orphaned requirements: REQUIREMENTS.md maps exactly these five IDs to Phase 11 (:209-211, :215-216), each is in a plan's `requirements`, and each is now `[x]` / Complete.

### Prohibitions (judgment tier)

All 14 prohibitions in the plans are `verification: judgment`; none is test-tier. Non-authoritative LLM-judge verdict: no violation found. The previous pass searched the phase diff. This pass also searched the added lines of 1183aae3 for "parity", "as Claude Code", and "match Claude Code" and found none. The PC-5 fix removed a comment that said "As in CommonMark" over a model that was not CommonMark's. The header now states the two rules that differ (:27-29). The rewritten page bullet keeps "Reason: project decision, with no Pi gap behind it" under "None of them is parity". The skip debug line names the path and the cause only (mention-attachments.ts:129). Flag: **unverified-prohibition, human review recommended** (maintainer_review item 5).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 1183aae3 files (`file-mentions.ts`, its test, `invocation.feature`, the page) | - | TBD / FIXME / XXX / TODO / HACK / skipped tests | none found ("placeholder" hits are the `$ARGUMENTS` feature) | - |
| `E/domain/file-mentions.ts:27-29`, `docs/skills-commands-compatibility.md:74` | - | the HTML-block gap is stated as "a code span in it is masked" only; a fence line in it can also skip or attach a later mention | ⚠️ Warning (doc) | advisory 2; override reason carries the behavior |
| `11-CONTEXT.md` | :132-138 | D-PG11-03 Residual text describes the closed iteration-3 residuals | ℹ️ Info (records) | advisory 1; maintainer's file |
| `E/domain/file-mentions.ts` `renderMentionBlock` | - | IN-01 (an empty file attaches an empty block; Pi skips one), IN-02 (`#L5-3` or `#L0` attach an empty block) | ℹ️ Info | unchanged; no criterion covers an empty file or a bad range |
| `E/orchestrators/skill-invocation.ts` | - | IN-03: an attached `</skill>` line followed by a blank line splits Pi's display of the skill block | ℹ️ Info | unchanged; display only |
| `E/domain/file-mentions.ts` | :557-562 | IN-04: dedup by text, so `@a.md` and `@./a.md` attach twice | ℹ️ Info | as 11-03 truth 4 specifies |
| `E/domain/name.ts`, `E/bridges/commands/discover.ts` | - | IN-05: a manifest map key `tools/lint` gets the stored name `plugin:tools:lint`, where the review reads upstream as `plugin:tools/lint` (unverified) | ℹ️ Info | unchanged; criterion 3 names the `commands/` file form |
| `E/bridges/skills/skill-names.ts` | - | IN-08: `commandUpstreamNames` ignores a frontmatter `name`; upstream conflict rule unverified | ℹ️ Info | unchanged |

The previous README warning is closed (29661a49). IN-09 and the list half of IN-11 are closed by 1183aae3.

### Human Verification Required

None for shipped behavior. The menu text is proven on real pi-tui screens, and the attachments on a scripted model's real input. The open points are the maintainer review items in the frontmatter:

1. **D-PG11-01 / decision 13:** confirm the Claude Code name alias, or descope PG-CMD-09.
2. **D-PG11-02:** confirm author-only mentions (criterion 1 rests on it).
3. **D-PG11-03:** keep the code skip or follow upstream. If kept, accept or reopen the two remaining gaps (HTML block, with its fence effect; the 100-container bound), and update the Residual text in 11-CONTEXT.md.
4. **D-PG11-06:** directory mentions are not attached; the decision has no PROJECT.md row.
5. **Judgment-tier prohibitions:** spot-check the 14 items.

### Gaps Summary

No gaps and no regression. 1183aae3 makes the mask match CommonMark in the four shapes the previous override carried, and the owner suites and Gate G pass on the tree. The one must-have that still does not hold as written is the 11-03 code-mask truth, in two rare shapes. One is the 100-container bound. The other is the HTML block, whose fence effect the docs do not state. The override carries both to the pending D-PG11-03 question. Criteria 1 to 3 also rest on D-PG11-01, -02, and -03, which are recorded and pending maintainer review.

---

_Verified: 2026-11-16T08:12:30Z_
_Verifier: Claude (gsd-verifier)_
