---
phase: 11-skills-commands-and-records
iteration: 2
created: 2026-11-15T00:00:00Z
fixed_at: 2026-11-15T00:00:00Z
review_path: .planning/phases/11-skills-commands-and-records/11-REVIEW.md
fix_scope: WR-03, IN-06, IN-07
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Source review:** `.planning/phases/11-skills-commands-and-records/11-REVIEW.md`
**Iteration:** 1
**Scope:** WR-01, WR-02. Info IN-01 to IN-05 are out of scope and stay open in REVIEW.md.

**Summary:**

- Findings in scope: 2
- Fixed: 2
- Skipped: 0

| Finding | Disposition | Commit | Evidence |
| ------- | ----------- | ------ | -------- |
| WR-01 | fixed: requires human verification (upstream-parity logic) | `3c9f6415` | Unit `test/orchestrators/skill-alias-state.test.ts`: 5 new rows, red 3 failed / 2 control rows passed without the fix; green 55/55. `test/bridges/skills/skill-names.test.ts` (new `declaresFrontmatterName` cases): green 46/46. Cucumber `features/slash-command/aliases.feature:147`: red 9 passed / 1 failed (the body reached the model for `/demo:demo-ship`); green 10/10 (adapter profile). |
| WR-02 | fixed: requires human verification (masking logic) | `4ba4a058` | Unit `test/domain/file-mentions.test.ts`: 12 new rows, red 8 failed / 4 control rows passed without the fix; green 85/85. Cucumber `features/slash-command/invocation.feature:336` (Scenario Outline, 2 new rows): red 1 passed / 2 failed; green, whole file 26/26 (adapter profile). |

## Fixed Issues

### WR-01: The stored "Claude Code name" is not Claude Code's name when the command sets frontmatter `name`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts`, `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts`, `extensions/pi-claude-marketplace/bridges/commands/command-record.ts` (comments only), `test/orchestrators/skill-alias-state.test.ts`, `test/bridges/skills/skill-names.test.ts`, `features/slash-command/aliases.feature`, `docs/skills-commands-compatibility.md`, `CHANGELOG.md`, `.planning/PROJECT.md`, `.planning/phases/11-skills-commands-and-records/11-CONTEXT.md`
**Commit:** `3c9f6415`

**Applied fix:** fixed in the reader, not the writer. `storedClaudeName` now returns no name when the staged frontmatter sets a `name` that Claude Code reads. The new `declaresFrontmatterName` in `skill-names.ts` checks this. It copies the 2.1.323 `dBt` sanitizer, which I re-read in the installed binary: a value that is present, whose `String()` form is not empty, and that has at most 256 characters (`Z0=256`; a longer name is "ignored"). Such a name replaces the path name (`Zt`). So a name with whitespace, a list, or a mapping also removes the path alias, although none of them adds an alias of its own. I fixed the reader for three reasons:

- `bridges/commands` cannot import the name limit from `bridges/skills`, because that is a cross-bridge zone.
- The reader already imports `frontmatterNameAliases`.
- Commands staged earlier on this branch get the fix with no restage.

The writer still stores the path name. The record comment now calls it the path name.

A command staged before D-PG11-01 has no stored name, so it behaves as before. The CMDNESTNAME-01 nested-name handling is unchanged. Four existing T-02-17 trust rows used `name: fancy`, so after the fix they would pass trivially. They now have no frontmatter name and expect no alias, so they still catch a bad stored name.

The `String()` call has a reasoned `eslint-disable-next-line @typescript-eslint/no-base-to-string`, because upstream also reads a mapping as `[object Object]`.

The compatibility page (line 15 and table row "Command alias from Claude Code's name", which now cites `features/slash-command/aliases.feature:147`), the CHANGELOG bullet, the PROJECT.md D-PG11-01 row, and the 11-CONTEXT.md D-PG11-01 evidence record now describe the rule. I appended the new scenario at the end of the feature file, so no earlier citation moved.

### WR-02: The code-span mask hides mentions outside code (escaped backticks, spans across list items or headings)

**Files modified:** `extensions/pi-claude-marketplace/domain/file-mentions.ts`, `test/domain/file-mentions.test.ts`, `features/slash-command/invocation.feature`, `docs/skills-commands-compatibility.md`, `.planning/phases/11-skills-commands-and-records/11-CONTEXT.md`
**Commit:** `4ba4a058`

**Applied fix:**

- **Escapes, as in CommonMark.** `closingRuns` now makes one backward pass over the runs. For each run it records the next run of the same length and the next run one backtick shorter, so it stays linear. `spanCloser` checks whether an odd number of backslashes comes right before the run. If so, the first backtick is escaped, and the rest of the run can still open a span (`\``x @a.md` here` is still a span). Inside a span a backslash is plain text, so `` `a\` `` still closes the span. A plain filter that drops runs after a backslash would get this case wrong, and a control row pins it.
- **Block boundaries.** I replaced the `PARAGRAPH_BREAK` split with a line-based `paragraphs()`. A new paragraph starts at a blank line (after any `>` markers), at a list item (`-`, `*`, `+`, `1.`, `1)`), at an ATX heading, on the line after a heading, and where the blockquote depth grows. Continuation lines of one blockquote or of one list item stay in the same paragraph, and control rows pin both cases. Any indentation counts as a block start. The only effect of over-splitting is that more mentions are attached, which is what upstream does. **Corrected in iteration 2:** this claim is false. A split lets a later backtick run pair with a different run, so it can hide a mention that CommonMark leaves in plain text (review IN-06).
- `maskFences` is unchanged.
- The `?.` on a regex that always matches was a branch no test could reach, and direct coverage reported it (branches 90/91). I replaced it with `replace` plus `slice`.

**Cucumber:** the cheap Outline row was possible. "A command attaches the file that its body mentions (PG-SKILL-01)" became a Scenario Outline with three rows:

- `as plain text`: the original case.
- `after an escaped backtick`
- `in a list item after an unclosed backtick`

The Outline converted the scenario in place, which moved the lines of the two scenarios after it. In `docs/skills-commands-compatibility.md` I updated their citations, 365 to 371 and 390 to 396, and the citation check passes. The page and the D-PG11-03 record in 11-CONTEXT.md now state the CommonMark rule.

## Verification

All gates ran in the isolated review-fix worktree, `.claude/worktrees/rf-11-974337-1794799786` under the `features/gaps` checkout. Its `node_modules` was a symlink to the `features/gaps` checkout's `node_modules`. Every unit run used `node --import "$PWD/test/platform/isolated-pi-home.ts" --test`. Every other command ran with `HOME` and `PI_CODING_AGENT_DIR` set to fresh `mktemp -d` directories. These numbers come from the same commits that are now on `features/gaps`, so they can be reproduced from the main checkout.

- `npm run typecheck`: exit 0.
- `npm run lint`: the first full run found 1 error, `no-base-to-string` in `skill-names.ts`. I fixed it with the reasoned disable. Then a scoped `eslint` run over all 7 changed `.ts` files exited 0, and the commit hook's `check:commit` ran the full `check:static` lint and passed on both commits.
- `npx fallow dead-code --quiet`: exit 0. `npx fallow health --quiet`: exit 0. I ran both after both fixes.
- `npm run check:features`: exit 0, after both fixes.
- `npm run test:coverage:direct -- <source>`: exit 0 for `bridges/skills/skill-names.ts`, `orchestrators/skill-alias-state.ts`, and `domain/file-mentions.ts`.
- Related unit suites (`mention-attachments`, `command-invocation`, `skill-invocation`): 215/215.
- Pre-commit: `npm run check:commit` passed on both commits.
- Citation check over `docs/skills-commands-compatibility.md`: passes.
- Not run: the full `npm run check` and the builtin cucumber profile. The new scenarios are not MCP scenarios, so only the adapter profile runs them.

---

_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2

**Source review:** `.planning/phases/11-skills-commands-and-records/11-REVIEW.md` (iteration 2)
**Scope:** WR-03, plus IN-06 and IN-07, which touch the same code. IN-01 to IN-05 and IN-08 stay open. IN-08 is out of scope because the upstream rule is not verified.

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

| Finding | Disposition | Commit | Evidence |
| ------- | ----------- | ------ | -------- |
| WR-03 | fixed: requires human verification (masking logic) | `8b1c0eb1` | Unit `test/domain/file-mentions.test.ts`: 5 new rows. Red: 4 failed, and the indented-dash control passed (86/90). Green: 90/90. Cucumber `features/slash-command/invocation.feature:336`, new row "after a thematic break under an unclosed backtick": red 3 passed / 1 failed; green, whole file 27/27 (adapter profile). |
| IN-06 | fixed: requires human verification (masking logic) | `bfca1330` | Unit: 19 new rows, each expectation checked against the CommonMark reference parser (commonmark.js 0.31, installed in a scratch directory). Red for the first 10 rows: 7 failed, 3 controls passed (93/100). The other 9 rows came from the fuzz below. 4 of them fail at HEAD, and the rest are controls or branch coverage. Green: 109/109. Cucumber, new row "after a code span over a line that starts with 2.": red at `8b1c0eb1` 4 passed / 1 failed; green, whole file 28/28. |
| IN-07 | fixed | `259f969a` | `features/slash-command/aliases.feature:147` is now an Outline with 4 rows. With `skill-alias-state.ts` reverted to `3c9f6415^`: 3 passed (the new positive rows) and 1 failed (`/demo:demo-ship`). Green: whole file 13/13. |

### WR-03: A thematic break or setext underline is not a block boundary

**Files modified:** `extensions/pi-claude-marketplace/domain/file-mentions.ts`, `test/domain/file-mentions.test.ts`, `features/slash-command/invocation.feature`, `docs/skills-commands-compatibility.md`, `.planning/phases/11-skills-commands-and-records/11-CONTEXT.md`
**Commit:** `8b1c0eb1`

**Applied fix:** I added `THEMATIC_BREAK` (three or more of one of `-`, `*`, `_`, with spaces between them) and `SETEXT_UNDERLINE` (`=+` or `-+`). Both start a block and end one. ESLint rejected the single regex the review proposed (`sonarjs/regex-complexity` 33 > 20), so the code has two regexes, and the thematic one uses a backreference. A dash line indented four spaces stays paragraph text, and a control row pins that. The new Examples row moved the two scenarios after the Outline. I updated their citations in the compatibility page (371 to 372, 396 to 397). IN-06 moved them once more.

### IN-06: An over-split can hide a mention that CommonMark leaves in plain text

**Files modified:** `extensions/pi-claude-marketplace/domain/file-mentions.ts`, `test/domain/file-mentions.test.ts`, `features/slash-command/invocation.feature`, `docs/skills-commands-compatibility.md`, `.planning/phases/11-skills-commands-and-records/11-CONTEXT.md`
**Commit:** `bfca1330`

**Applied fix:** this is a full fix for the two counterexamples, not only a comment change. The splitter now keeps a small state for each paragraph: its quote depth, whether it is in a list, and whether it is an indented block. It follows these rules:

- Outside a list, an item ends paragraph text only when it is indented less than four columns (a tab counts as four), has text, and has the number 1 if it is numbered. This is CommonMark's interruption rule. An empty item (`*`, `1.`) no longer splits.
- On a line that leaves the paragraph's blockquote, any item can start a block, as in CommonMark, because the paragraph is not the matched container there.
- A heading or a thematic break indented four spaces or more under text stays paragraph text.
- A setext underline ends the paragraph only when it follows text in the same blockquote. An underline that opens a paragraph is text, and a lazy underline under a blockquote is text. This corrects a case that `8b1c0eb1` added.
- An indented block ends at a line indented less. This drop also happens at HEAD.
- The quote depth is now compared with the paragraph's first line, not with the line before it. So a lazy line followed by `> ...` stays one paragraph. This drop also happens at HEAD.
- `QUOTE_MARKERS` now takes the one space after `>` that belongs to the marker. Without it, `>    - x` would read as indented four columns.
- Inside a list (a paragraph that starts at an item, or an indented paragraph after one), every item and heading still starts a block, at any indentation. This is the remaining approximation.

I removed the false comment ("only lets more mentions through"). The compatibility page sentence (line 74) and the D-PG11-03 record in 11-CONTEXT.md now describe these rules and name the list residual. Neither says "as in CommonMark" for the whole rule anymore. The new Examples row moved the citations again (372 to 373, 397 to 398), and the citation check passes.

**Fuzz against the reference parser** (a scratch script, not committed). It ran random 2- to 4-line bodies built from list, quote, heading, break, underline, indent, and backtick fragments, and compared "is `@b.md` attached" with commonmark.js. Before the per-paragraph state there were 84 drops in about 54,000 bodies. After it there were 7, and all 7 are nested-list shapes. An example is `- more \`\n  2. more \`\n@b.md \`y`: CommonMark reads `  2.` as text of the item, and the bridge splits there. Over-attaches (the bridge attaches and CommonMark does not) are the direction upstream takes. Most of them come from indented code, which D-PG11-03 does not treat as code.

**Residual:** inside a list, a nested line that CommonMark reads as paragraph text can end a span early, so a mention outside code can be skipped. Closing it would need CommonMark's container model: content indentation for each item, and lazy continuation across levels. Both D-PG11-03 and the compatibility page record this residual.

### IN-07: The WR-01 scenario only proves a negative

**Files modified:** `features/slash-command/aliases.feature`
**Commit:** `259f969a`

**Applied fix:** the scenario is now `Scenario Outline: A command whose frontmatter sets a name sends <typed name> to the model as <what the model gets>`, on the same `demo-ship.md` fixture with `name: fancy`. The rows are `/demo:ship`, `/demo:fancy`, and `/fancy`, which get the body with `ARGUMENTS: production`, and `/demo:demo-ship`, which stays plain text. The title stays on line 147, and it was the last scenario in the file, so no citation moved. The compatibility page's claim on line 15 is now proven by the row in the table that cites `:147`.

### Verification (iteration 2)

The caller told me to work in the main checkout. So every gate ran in `/home/acolomba/src/pi-claude-marketplace-gaps` on `features/gaps`, with no worktree. Anyone can rerun these numbers from that tree. Every unit run used `node --import "$PWD/test/platform/isolated-pi-home.ts" --test`. Cucumber ran through `npm run test:cucumber:profile -- --profile adapter`. Every other command, the commits included, ran with `HOME` and `PI_CODING_AGENT_DIR` set to fresh `mktemp -d` directories. For pre-commit I set `PYTHONUSERBASE`, `PRE_COMMIT_HOME`, and a `GIT_CONFIG_COUNT` identity, because the temp HOME hides them.

- Before each commit: `npm run typecheck` exit 0; `eslint` on the changed `.ts` files exit 0; `npx fallow dead-code --quiet`, `npx fallow health --quiet`, and `npx fallow dupes --quiet` exit 0; `npm run check:features` exit 0; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/file-mentions.ts` exit 0. The commit hook's `check:commit` passed on all three commits.
- Related unit suites (`file-mentions`, `mention-attachments`, `command-invocation`, `skill-invocation`): 239/239.
- Citation check over `docs/skills-commands-compatibility.md`: passes.
- Not run: the full `npm run check` and the builtin cucumber profile.

---

_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
