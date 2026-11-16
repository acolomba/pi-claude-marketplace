---
phase: 11-skills-commands-and-records
verified: 2026-11-16T05:21:52Z
status: passed
score: "7/7 must-haves verified (6 verified, 1 passed by override: the documented CommonMark residual of the D-PG11-03 code mask, carried to maintainer review)"
covered_files: [".planning/phases/11-skills-commands-and-records/11-01-PLAN.md",".planning/phases/11-skills-commands-and-records/11-01-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-02-PLAN.md",".planning/phases/11-skills-commands-and-records/11-02-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-03-PLAN.md",".planning/phases/11-skills-commands-and-records/11-03-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-04-PLAN.md",".planning/phases/11-skills-commands-and-records/11-04-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-05-PLAN.md",".planning/phases/11-skills-commands-and-records/11-05-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-06-PLAN.md",".planning/phases/11-skills-commands-and-records/11-06-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-07-PLAN.md",".planning/phases/11-skills-commands-and-records/11-07-SUMMARY.md",".planning/phases/11-skills-commands-and-records/11-08-PLAN.md",".planning/phases/11-skills-commands-and-records/11-08-SUMMARY.md","CHANGELOG.md","README.es.md","README.md","docs/env-vars.md","docs/mcp-compatibility.md","docs/prd/parity-gaps-prd.md","docs/prd/pi-claude-marketplace-prd.md","docs/research/claude-hooks-vs-pi-events.md","docs/skills-commands-compatibility.md","extensions/pi-claude-marketplace/bridges/commands/command-record.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts","extensions/pi-claude-marketplace/bridges/skills/skill-names.ts","extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts","extensions/pi-claude-marketplace/domain/file-mentions.ts","extensions/pi-claude-marketplace/domain/mcp-resolution.ts","extensions/pi-claude-marketplace/domain/name.ts","extensions/pi-claude-marketplace/edge/skill-aliases.ts","extensions/pi-claude-marketplace/orchestrators/command-invocation.ts","extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts","extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts","extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts","features/mcp-server/sources.feature","features/skill/aliases.feature","features/skill/invocation.feature","features/slash-command/aliases.feature","features/slash-command/frontmatter.feature","features/slash-command/invocation.feature","test/bridges/commands/command-record.test.ts","test/bridges/commands/stage.test.ts","test/bridges/commands/staged-command.test.ts","test/bridges/skills/skill-names.test.ts","test/domain/file-mentions.test.ts","test/domain/name.test.ts","test/edge/skill-aliases.test.ts","test/orchestrators/command-invocation.test.ts","test/orchestrators/mention-attachments.test.ts","test/orchestrators/skill-alias-state.test.ts","test/orchestrators/skill-invocation.test.ts","test/orchestrators/typed-expansion.test.ts"]
covered_digest: "v4:sha256:9337294c58e3909eb78f77f3a2e582597ff0c76d02784b9b1e8af4e8ecbaf236"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "11-03 truth: a mention inside fenced code, with a backtick or a tilde fence, closed or not, or inside a code span is not returned, in every Markdown shape (CommonMark agreement of the D-PG11-03 mask)."
    reason: "The mask approximates CommonMark, and in three documented shapes it disagrees with it: inside a list it does not track an item's content column (a fence indented four columns or more in a list item is not recognized, so `1. Step:\\n\\n    ```\\n    see @b.md\\n\\n    more\\n    ``` ` attaches b.md; and `- a `x\\n    2. @b.md `y` attaches a mention CommonMark puts in a span), and it counts a tab after `>` as four columns (`>\\tUse `x\\n#tag @b.md `y` attaches; `> Note `x\\n>\\t- @b.md `y` skips). I reproduced all three at HEAD. Each residual is recorded in D-PG11-03 (11-CONTEXT.md) and on docs/skills-commands-compatibility.md in both directions, and review IN-09 and IN-11 (list half) keep them open. D-PG11-03 itself is pending maintainer review: if the maintainer follows Claude Code and drops the mask, every residual goes away; if the skip stays, the maintainer decides whether the approximation is enough. Not a fix-it-instead case: the shapes are rare, the success-criterion shapes (fence, code span, `!` command) all pass, and the attach direction of the list-fence residual is the direction Claude Code takes for every mention."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-16T05:21:52Z"
# The items below are maintainer review points carried out of the phase; none is a test of shipped behavior.
maintainer_review:
  - test: "D-PG11-01 (PRD decision 13, amends D-141-01): read the row in .planning/PROJECT.md:2441 and confirm that a bridged command also answers to Claude Code's name for it, `/<plugin>:<path>:<file>`, while the listed name keeps the D-141-01 elision."
    expected: "Confirmed: the row stops saying 'Pending maintainer review' and PG-CMD-09 stands. A 'no' moves PG-CMD-09 to Out of Scope (ROADMAP Phase 11 discuss step), removes the stored `claudeName` alias source, and success criterion 3 must be amended."
    why_human: "The ROADMAP says decision 13 comes first and a 'no' descopes PG-CMD-09. An autonomous discussion answered it; only the maintainer can confirm."
  - test: "D-PG11-02 (PROJECT.md:2442): confirm that only the @ mentions the author wrote are attached, a divergence from Claude Code 2.1.323 licensed by Pi's missing Read permission gate."
    expected: "Confirmed: success criterion 1 stands as verified. Reversed: the scan input becomes the rendered text, and criterion 1 (`/demo:review @/etc/hostname` attaches nothing) must be amended."
    why_human: "Criterion 1 passes because of this recorded divergence, which is pending maintainer review."
  - test: "D-PG11-03 (PROJECT.md:2443, 11-CONTEXT.md): keep the skip of mentions inside code, or follow Claude Code and change success criterion 2. If the skip stays, accept or reject the documented CommonMark residual (the override above; review IN-09 and IN-11 list half)."
    expected: "Keep: criterion 2 stands, and the residual is accepted or reopened as a new item. Follow upstream: the mask is dropped, criterion 2 is amended, and the residual disappears."
    why_human: "A divergence with no Pi gap behind it, licensed by the recorded decision alone and pending maintainer review."
  - test: "D-PG11-06 (11-CONTEXT.md, listed there as pending maintainer review): a directory mention is not attached, where Claude Code attaches an `ls` listing. This decision has no Key Decisions row in PROJECT.md (D-PG11-14 asked only for rows 01 to 03)."
    expected: "Confirmed or sent back; if it is to stay a recorded divergence, it gets a PROJECT.md row."
    why_human: "A recorded policy choice pending maintainer review; the code matches it as written (mention-attachments.ts, 'it is not a regular file')."
  - test: "Judgment-tier prohibitions of plans 11-01 to 11-08 (14 items, all verification: judgment, none test-tier)."
    expected: "No comment, title, README, CHANGELOG, record, or doc calls D-PG11-02, D-PG11-03, or the D-PG11-06 directory rule parity; no text says command names now match Claude Code's; no text says a skill's argument-hint shows everywhere; no file content reaches a debug line; no corrected claim read but not run is stated as measured; no dated audit or BACKLOG entry was rewritten or closed."
    why_human: "The verifier's check is an LLM judgment, not authoritative (see the Prohibitions section). Human review recommended."
---

# Phase 11: Skills, Commands, and Records Verification Report

**Phase Goal:** A typed plugin command or skill attaches the files its author referenced, a command answers to the name Claude Code gives it, and alias suggestions show what their target does. Skills and commands get a compatibility page whose every row cites its proof, and the records that no requirement owns are corrected.
**Verified:** 2026-11-16T05:21:52Z
**Status:** passed (one override for a maintainer-pending residual; five maintainer review items)
**Re-verification:** No. This is the first verification.

Evidence base. I read the code at HEAD 46fe9693. The full gate log `/tmp/pg11-phasegate2.log` starts with `head=9874efc2`, ends with `exit=0`, and records adapter `2094 scenarios (2094 passed)`, builtin `204 scenarios (204 passed)`, and `Merged LCOV: coverage/direct.lcov (374 records)`. `git diff --name-only 9874efc2 HEAD` lists only `11-VALIDATION.md`, so every scenario named below passed on the code verified here. I also ran, in a hermetic home (fresh `HOME` and `PI_CODING_AGENT_DIR`, `test/platform/isolated-pi-home.ts`), the eleven owner suites of the phase: 719/719 pass. And I re-ran the iteration-3 red/green claim myself (see Behavioral Spot-Checks).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: a command body `Review @${CLAUDE_PLUGIN_ROOT}/templates/x.md` reaches the scripted model with the template text in a `<file>` block. `/demo:review @<path>` gives the model the argument as text with no `<file>` block (PG-SKILL-01). | ✓ VERIFIED | `features/slash-command/invocation.feature:336` row `as plain text`: the model gets `Review @{home}/.../templates/x.md\n\n<file name="{home}/.../templates/x.md">\nCheck the spelling.\n</file>`. `:374`: body `Review $ARGUMENTS`, typed `/demo:review @{home}/.../templates/x.md` names an existing file, and the model gets the text only. The scenario uses a fixture file instead of `/etc/hostname`, as D-PG11-13 allows; an existing file makes the guard stronger. Skill side: `features/skill/invocation.feature:350` (typed alias, block inside `</skill>`), `:375` (argument not attached). Code: `command-invocation.ts` `renderCommand` and `skill-invocation.ts` `fillSkill` build `authored` with `substituteArguments({ args: undefined })`, which fills variables only (`argument-substitution.ts:243-245`), and pass it to `appendMentionedFiles` after `expandContextInjections`. |
| 2 | SC2: a `@path` inside fenced code or a code span, or in the output of an injected `!` command, is not attached (PG-SKILL-01). | ✓ VERIFIED | `invocation.feature:399` rows `in fenced code`, `in a code span`, `in a context command and its output` (the model gets `Shown: @{home}/.../x.md`, the `!` output, with no block), and `in a code span over an unindented === line in a list`. The `!` row fails under a rendered-text scan, since the output is plain text after expansion. The code scans `authored`, which never holds `!` output. Unit: `test/domain/file-mentions.test.ts` 115/115. The rare-shape residual is truth 7. |
| 3 | SC3: with `demo/commands/demo-lint.md`, `/demo:demo-lint x` sends the command body, as `/demo:lint x` does (PG-CMD-09). | ✓ VERIFIED | `features/slash-command/aliases.feature:41` Outline rows `/demo:lint`, `/demo:demo-lint`, and `/demo:demo-tools:lint`, each `Lint the sources.\n\nARGUMENTS: src`. Code: `domain/name.ts` `claudeCommandName` joins plugin and path segments with `:`, nothing elided; `staged-command.ts` stores it as `claudeName` in the install record; `skill-alias-state.ts` `storedClaudeName` adds it unless `declaresFrontmatterName` (WR-01), under the plugin's own prefix, with no whitespace. The existing `claimedAliases` and reserved-name rules apply. `aliases.feature:147` proves the frontmatter-name case (`/demo:demo-ship` is plain text). |
| 4 | SC4: the alias scenarios in `features/skill/aliases.feature` and `features/slash-command/aliases.feature` assert the description column: each alias suggestion shows its target's description and, for a skill, its `argument-hint` (PG-SKILL-11). | ✓ VERIFIED | `skill/aliases.feature:238` (`demo:fancy` / `<change>` / `Reviews a change.`) and `:256` (`[change]` shows `change`); `slash-command/aliases.feature:130` (`Ships the branch.`, was empty); `slash-command/frontmatter.feature:190-196` row `demo:demo-skill` now `A skill of demo 1.0.0.`. The step (`features/step_definitions/slash-command/frontmatter.steps.ts:147`) reads real pi-tui screen rows and splits hint and description. Code: `edge/skill-aliases.ts` `menuDescription` builds `hint — description` as pi-tui 1.5.0 does; `skill-alias-state.ts` `menuText` reads the staged `description` and `argument-hint`. |
| 5 | SC5 (PG-DOC-01): `docs/skills-commands-compatibility.md` covers the dropped fields, `!` injection, `run_plugin_command`, the skill-read fill, and the name mapping, and each row of its status table cites a scenario that passes. | ✓ VERIFIED | Sections: Name mapping, Alias suggestions, Context commands (`!`), File mentions (D-PG11-02, -03, -06 stated as differences, "None of them is parity"), Frontmatter fields (dropped fields), The model's command tool, The skill-read fill, Status, Not proven by a scenario, Deferred. Citation check: 0 `BAD`, 129 distinct citations (133 total) on 35 lines; every one of the 35 status rows cites at least one `features/<dir>/<file>.feature:<line>`, and each cited line starts a `Scenario`. I read the twelve citations of this phase's rows and each one states the row's behavior. All cited scenarios passed in the gate log. Both READMEs link the page (`README.md:125`, `README.es.md:125`). |
| 6 | SC5 (PG-DOC-02): the eight statements that the PRD's section 10 marks "none" are corrected, and a claim only a spike can settle is marked unmeasured. | ✓ VERIFIED | The four removal greps of 11-RESEARCH.md "Validation Architecture" print nothing. New text per row (all eight PRD section 10 rows): (1) event count, `claude-hooks-vs-pi-events.md` amendment: 41 events in Pi 1.5.0 and 1.5.2 (I counted 41 `on(event: "` overloads in the installed Pi 1.5.0 `types.d.ts`); (2) first-party claim: nine events, `claude-security` uses `PermissionRequest`, unsupported; (3) `tool_search`: `mcp-compatibility.md` table row and divergence bullet, BACKLOG TOOLSEARCHOFF-01, codemode reach marked "Unmeasured"; (4) bundle reason: `mcp-compatibility.md` (two places), `mcp-resolution.ts` comment, `sources.feature:405` description, BACKLOG MCPB-01: Claude Code has no runner either, the blocker is project work; (5) proof paths: page header and source note, `builtin-overrides.ts` and `builtin-mcp-tool-names.ts` comments: right for Pi 1.5.0, moved to `@earendil-works/pi-mcp` in 1.5.1; (6) `env-vars.md` `PATH`: matrix `E♦`, Hooks and MCP rows `✗`, "read in its binary and not run", D-PG11-10; (7) BACKLOG WOUT-01 heading fixed and 3.13.1 bound marked "read ... not run", UAT-02 premise out of date and marked unmeasured; (8) `pi-claude-marketplace-prd.md` section 3 "Component": hooks supported in part, workflows supported. |
| 7 | 11-03 truth: a mention inside fenced code (closed or not) or a code span is not returned, in every Markdown shape. | PASSED (override), carried to maintainer review; see `overrides` | Three documented shapes disagree with CommonMark, reproduced at HEAD: a list-item fence indented 4+ columns with a blank line inside (attached), `- a `x\n    2. @b.md `y` (attached), and a tab after `>` (`>\tUse `x\n#tag @b.md `y` attached, `> Note `x\n>\t- @b.md `y` skipped). Recorded in D-PG11-03 and on the page in both directions; review IN-09 and IN-11 (list half) stay open. |

**Score:** 7/7 truths (6 verified, 1 passed by override; 0 present, behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/file-mentions.ts` | pure mention parser, code mask, file block | ✓ VERIFIED | 530 lines; imports only `shared/bom.ts`; consumed by `mention-attachments.ts` |
| `extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts` | stat, size, NUL, read behind `MentionFileReader` | ✓ VERIFIED | used by both invocation orchestrators through the required `mentions` dependency; debug line names path and cause only |
| `orchestrators/command-invocation.ts`, `orchestrators/skill-invocation.ts` | wiring on the typed paths only | ✓ VERIFIED | `expandStagedCommand` and `fillSkillRead` ask the reader for nothing (owner tests `D-PG11-07: asks the mention reader for nothing...`) |
| `domain/name.ts` `claudeCommandName`, `bridges/commands/command-record.ts`, `staged-command.ts` | Claude Code name stored at staging | ✓ VERIFIED | `claudeName` optional in the schema, so an old record still reads |
| `orchestrators/skill-alias-state.ts`, `edge/skill-aliases.ts` | alias from the stored name; menu text | ✓ VERIFIED | `PluginAliasTarget.menu` required on both arms |
| `docs/skills-commands-compatibility.md` | compatibility page with cited status table | ✓ VERIFIED | 183 lines, 35 cited rows |
| `.planning/PROJECT.md` rows D-PG11-01..03, D-141-01 amendment | records | ✓ VERIFIED | `:2441-2443`, each "Pending maintainer review"; D-141-01 says "Amended by D-PG11-01" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| typed command | `appendMentionedFiles` | `renderCommand` after `expandContextInjections` | WIRED | `invocation.feature:336` |
| typed skill and alias | `appendMentionedFiles` | `fillSkill`, blocks inside `skillBlock` | WIRED | `skill/invocation.feature:350` |
| staging | alias table | `claudeName` in record -> `storedClaudeName` -> `COMMAND_KIND.names` | WIRED | `aliases.feature:41` |
| staged frontmatter | Pi menu row | `menuText` -> `PluginAliasTarget.menu` -> `menuDescription` | WIRED | `skill/aliases.feature:238` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| file block | `blocks` | real `stat`/`open` of the mentioned file (`NODE_MENTION_FILE_READER`) | yes, the fixture text reaches the scripted model | ✓ FLOWING |
| alias menu row | `target.menu` | staged frontmatter read in the same pass as the names | yes, real pi-tui screen rows | ✓ FLOWING |
| Claude Code alias | `claudeName` | stage-time `claudeCommandName(pluginName, sourceName)` | yes, `/demo:demo-lint src` reaches the model | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| owner suites of the phase | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test` on `file-mentions`, `mention-attachments`, `command-invocation`, `skill-invocation`, `skill-alias-state`, `edge/skill-aliases`, `skill-names`, `command-record`, `staged-command`, `commands/stage`, `name` tests (fresh `HOME`, `PI_CODING_AGENT_DIR`) | 719 pass, 0 fail | ✓ PASS |
| WR-04/WR-05 red/green | HEAD `file-mentions.test.ts` run in the scratchpad against the module of `d2b55120` (before the fixes) and of HEAD | `d2b55120`: 110 pass, 5 fail (the two WR-04 rows, the three WR-05 / IN-11-blockquote rows); HEAD: 115 pass | ✓ PASS, matches 11-REVIEW-FIX.md iteration 3 exactly |
| WR-04/WR-05 bodies | `findFileMentions` on the review bodies at `d2b55120`, `2222bacd`, HEAD | WR-05 body: `[]`, `[b.md]`, `[b.md]` (CommonMark: text). WR-04 bodies: `[b.md]`, `[b.md]`, `[]` (CommonMark: span). The indented-underline control stays `[b.md]` | ✓ PASS |
| every named scenario | full gate log `/tmp/pg11-phasegate2.log` at 9874efc2 (code identical to HEAD) | adapter 2094/2094, builtin 204/204, `exit=0` | ✓ PASS (artifact read, not re-run, per dispatch) |
| citation check (PG-DOC-01) | the check of 11-RESEARCH.md plus a count | 0 `BAD`; 35 citation lines; 129 distinct citations | ✓ PASS |

I did not re-run the cucumber red runs of iteration 3. The module-level red/green above covers the same bodies as the two new cucumber rows.

### Probe Execution

Step 7c: SKIPPED. No plan or summary declares a `probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PG-SKILL-01 | 11-03, 11-04, 11-05, 11-07 | attach author-written `@path` to existing regular text files; not from arguments, `!` output, or code | ✓ SATISFIED (D-PG11-02, -03 pending maintainer review; rare-shape residual by override) | Truths 1, 2, 7 |
| PG-CMD-09 | 11-01, 11-07 | a command also answers to `/<plugin>:<path>:<file>` | ✓ SATISFIED (D-PG11-01 pending maintainer review) | Truth 3 |
| PG-SKILL-11 | 11-02, 11-07 | alias suggestion shows target's description and a skill's `argument-hint` | ✓ SATISFIED | Truth 4 |
| PG-DOC-01 | 11-08 | compatibility page, each status row cites its scenario | ✓ SATISFIED | Truth 5 |
| PG-DOC-02 | 11-06 | the eight "none" statements corrected; spike-only claims marked unmeasured | ✓ SATISFIED | Truth 6 |

No orphaned requirements: REQUIREMENTS.md maps exactly these five IDs to Phase 11, and each appears in a plan's `requirements`. REQUIREMENTS.md still shows each as `[ ]` / Pending; the orchestrator updates that at phase completion.

### Decision Coverage

`check.decision-coverage-verify`: 14 of 14 trackable CONTEXT.md decisions honored by shipped artifacts. All trackable CONTEXT.md decisions are honored by shipped artifacts.

### Test Quality Audit

| Test File | Linked Req | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|---------|----------|-----------------|---------|
| `test/domain/file-mentions.test.ts` | PG-SKILL-01 | 0 | no | value | ✓ |
| `test/orchestrators/mention-attachments.test.ts` | PG-SKILL-01 | 0 | no (real files in a hermetic temp root) | value | ✓ |
| `test/orchestrators/{command,skill}-invocation.test.ts` | PG-SKILL-01 | 0 | no | value, plus strict-reader guards | ✓ |
| `test/orchestrators/skill-alias-state.test.ts`, `test/edge/skill-aliases.test.ts` | PG-CMD-09, PG-SKILL-11 | 0 | no | value | ✓ |
| cucumber rows cited above | all four code requirements | 0 | no | behavioral (scripted model input, real TUI screen) | ✓ |

Disabled tests on requirements: 0. Circular patterns: 0. Insufficient assertions: 0.

### Prohibitions (judgment tier)

All 14 prohibitions in the plans are `verification: judgment`; none is test-tier. Non-authoritative LLM-judge verdict: no violation found. I searched the added lines of the phase diff (code, features, tests, docs, READMEs, CHANGELOG, PROJECT.md, BACKLOG.md) for "parity", "as Claude Code does", and "match Claude Code". The page says "These rules differ from Claude Code 2.1.323. None of them is parity"; the D-PG11-02 and -03 rows say "divergence" and "read in the binary, not run"; the CHANGELOG says a command "also answers to" the upstream name; the one "as Claude Code does" test title (`skill-names.test.ts`, `declaresFrontmatterName`) is about reading a frontmatter `name`, which is parity. The mention debug line names the path and the cause only. BACKLOG entries got dated "Out of date 2026-11-15" paragraphs and none was closed. Flag: **unverified-prohibition, human review recommended** (maintainer_review item 5).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| phase diff (`extensions`, `features`, `test`, `docs`, READMEs, CHANGELOG, from `c4bcf962^`) | - | TBD / FIXME / XXX / TODO / HACK / placeholder / skipped tests | none found | - |
| `README.md:114`, `README.es.md:114` | - | "When that name is different from the Pi name, the command also answers to it" omits the WR-01 rule that a frontmatter `name` drops the path alias (`aliases.feature:147` row `/demo:demo-ship` is plain text). The CHANGELOG ("with no frontmatter `name`") and the compatibility page state it. | ⚠️ Warning (doc) | no success criterion names the README; a reader may expect `/demo:demo-ship` to work |
| `domain/file-mentions.ts` | mask | review IN-09 and IN-11 list half, the list residual | ℹ️ Info | truth 7 override; maintainer item 3 |
| `domain/file-mentions.ts` `renderMentionBlock` | - | IN-01 (an empty file attaches an empty block; Pi skips one), IN-02 (`#L5-3` or `#L0` attach an empty block) | ℹ️ Info | no criterion covers an empty file or a bad range |
| `orchestrators/skill-invocation.ts` | - | IN-03: an attached `</skill>` line followed by a blank line splits Pi's display of the skill block | ℹ️ Info | display only; the model gets the whole text |
| `domain/file-mentions.ts` | - | IN-04: dedup by text, so `@a.md` and `@./a.md` attach twice | ℹ️ Info | - |
| `domain/name.ts`, `bridges/commands/discover.ts` | - | IN-05: a manifest map key `tools/lint` gets the stored name `plugin:tools:lint`, where the review reads upstream as `plugin:tools/lint` (unverified). PG-CMD-09 names the `commands/` file form, which criterion 3 proves | ℹ️ Info | edge of PG-CMD-09 for map-key commands; not in this diff |
| `bridges/skills/skill-names.ts` | - | IN-08: `commandUpstreamNames` ignores a frontmatter `name`; upstream conflict rule unverified | ℹ️ Info | - |
| `11-VALIDATION.md` | frontmatter | `nyquist_compliant: false` while the sign-off list ticks `nyquist_compliant: true` (same as phase 10) | ℹ️ Info | planning record inconsistency |

None of the open review items breaks a success criterion as the criteria and their scenarios state them. IN-09 and IN-11 (list half) are the only ones that touch a criterion's wording (SC2, and PG-SKILL-01's "attaches each ... reference its author wrote" in the tab-after-`>` skip case); they hold only in rare shapes, they are documented, and truth 7 carries them by override to the D-PG11-03 maintainer question.

### Human Verification Required

None for shipped behavior. The menu text is proven on real pi-tui screens, and the attachments on a scripted model's real input. The open points are the maintainer review items in the frontmatter:

1. **D-PG11-01 / decision 13:** confirm the Claude Code name alias, or descope PG-CMD-09.
2. **D-PG11-02:** confirm author-only mentions (criterion 1 rests on it).
3. **D-PG11-03:** keep the code skip or follow upstream; if kept, accept or reopen the CommonMark residual.
4. **D-PG11-06:** directory mentions not attached; it has no PROJECT.md row.
5. **Judgment-tier prohibitions:** spot-check the 14 items above.

### Gaps Summary

No gaps. The code delivers success criteria 1 to 5, and the scenarios that prove them passed in the final gate on code identical to HEAD. I re-checked the iteration-3 red and green claim for WR-04 and WR-05 and got the same numbers. The phase is `passed` by the phase 10 convention: the one must-have that does not hold literally is the documented CommonMark residual of the code mask, carried by an override to the pending D-PG11-03 question. Criteria 1 to 3 also rest on D-PG11-01, -02, and -03, which are recorded and pending maintainer review.

---

_Verified: 2026-11-16T05:21:52Z_
_Verifier: Claude (gsd-verifier)_

## Post-verification note 2026-11-16

The verifier's docs warning is fixed in 29661a49. `README.md` and `README.es.md` now say that a command answers to its path-based Claude Code name only when its frontmatter does not set `name`, as `slash-command/aliases.feature:147` proves. The `11-VALIDATION.md` frontmatter now reads `nyquist_compliant: true`. The fingerprint above was recomputed with `verification.fingerprint` after the README change, over the same 56 files.
