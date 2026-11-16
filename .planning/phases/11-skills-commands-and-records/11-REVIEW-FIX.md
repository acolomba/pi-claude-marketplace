---
phase: 11-skills-commands-and-records
iteration: 1
created: 2026-11-15T00:00:00Z
fixed_at: 2026-11-15T00:00:00Z
review_path: .planning/phases/11-skills-commands-and-records/11-REVIEW.md
fix_scope: critical_warning
findings_in_scope: 2
fixed: 2
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
- **Block boundaries.** I replaced the `PARAGRAPH_BREAK` split with a line-based `paragraphs()`. A new paragraph starts at a blank line (after any `>` markers), at a list item (`-`, `*`, `+`, `1.`, `1)`), at an ATX heading, on the line after a heading, and where the blockquote depth grows. Continuation lines of one blockquote or of one list item stay in the same paragraph, and control rows pin both cases. Any indentation counts as a block start. The only effect of over-splitting is that more mentions are attached, which is what upstream does.
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
