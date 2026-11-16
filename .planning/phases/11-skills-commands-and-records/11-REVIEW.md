---
phase: 11-skills-commands-and-records
iteration: 2
reviewed: 2026-11-15T00:00:00Z
depth: standard
diff_base: 82e133d1
files_reviewed: 11
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/commands/command-record.ts
  - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
  - extensions/pi-claude-marketplace/domain/file-mentions.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - features/slash-command/aliases.feature
  - features/slash-command/invocation.feature
  - test/bridges/skills/skill-names.test.ts
  - test/domain/file-mentions.test.ts
  - test/orchestrators/skill-alias-state.test.ts
  - docs/skills-commands-compatibility.md
  - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
findings:
  critical: 0
  warning: 1
  info: 8
  total: 9
status: issues_found
---

# Phase 11: Code Review Report (iteration 2)

**Reviewed:** 2026-11-15T00:00:00Z
**Depth:** standard
**Diff:** `82e133d1..HEAD` (fixes `3c9f6415` for WR-01 and `4ba4a058` for WR-02)
**Files Reviewed:** 11 (`staged-command.ts` was read as context for WR-01; it is not in the diff)
**Status:** issues_found

## Summary

Both iteration-1 fixes hold for the cases they name. I checked each one against the source and against upstream:

- **WR-01.** I re-read `dBt` and the plugin command builder in the installed 2.1.323 binary. `dBt` returns `undefined` for `null` and `undefined`, and also for a `String()` result over `Z0` (256). The builder then uses `Zt` whenever `ln` is truthy. `declaresFrontmatterName` matches this, the empty string included (falsy, so the path name stays). The reader-side guard in `storedClaudeName` is enough because `buildStagedCommand` copies the source frontmatter `name` into the staged file unchanged (`stagedFrontmatter` spreads `source`). The nested and Windows cases still drop the path name correctly.
- **WR-02.** The backward pass in `closingRuns` and the escape check in `spanCloser` follow CommonMark. An escaped run of N backticks opens at N-1, a run of one escaped backtick opens nothing, and inside a span a backslash is plain text. `paragraphs()` keeps offsets and line count, because the groups are joined again with `\n`.

**Red/green check.** I ran the new `test/domain/file-mentions.test.ts` in a scratch copy against the `82e133d1` module, outside the working tree: 8 failed and 77 passed. Against HEAD all 85 pass, which matches the fix record. The skill-alias-state rows fail without the guard. I did not rerun them; I traced it in the code: the stored `demo:demo-ship` passes the prefix and whitespace checks, so the plain, whitespace, and list rows would get an extra alias, and the empty and over-long rows are controls. The same tracing says the cucumber rows fail without their fix. Scoped units (skill-names, file-mentions, skill-alias-state, mention-attachments) pass: 206/206 under the isolated home.

**New findings.** The block-boundary fix is not complete. A thematic break or a setext underline right after a text line still lets a code span cross it, so a mention in plain text is dropped silently (WR-03). The fix also claims that over-splitting only attaches more mentions. That is false, and I give two counterexamples, both checked with `marked` (IN-06). The other new Info items are about test strength (IN-07) and one adjacent place where the WR-01 rule is not applied (IN-08, pre-existing, not verified upstream).

`necessity-review.md` was not read for this iteration, so there is no `necessity:` count.

## Iteration 1 dispositions

| ID    | Disposition | Notes |
| ----- | ----------- | ----- |
| WR-01 | Fixed, verified | `declaresFrontmatterName` + guard in `storedClaudeName`; matches 2.1.323 `dBt`/`Zt`. |
| WR-02 | Fixed for escapes, list items, ATX headings, blockquotes; partially open | Thematic breaks and setext underlines are still not boundaries (WR-03). |
| IN-01 | Open | `renderMentionBlock` (`file-mentions.ts:386-407`) still attaches an empty file as an empty block. |
| IN-02 | Open | A reversed or zero range still gives an empty block (`file-mentions.ts:396-400`). |
| IN-03 | Open | Not in this diff; `skill-invocation.ts` unchanged. |
| IN-04 | Open | Dedup is still by text (`file-mentions.ts:342-355`). |
| IN-05 | Open | Not in this diff; `name.ts` unchanged. |

## Narrative Findings (AI reviewer)

## Warnings

### WR-03: A thematic break or setext underline is not a block boundary, so a mention in plain text is still dropped

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:74-78` (`BLOCK_START`), `:228-250` (`lineShape`, `startsParagraph`)

**Issue:** WR-02 asked for a code span never to cross a block boundary. The fix knows four kinds of boundary: a blank line, a list item, an ATX heading, and a deeper blockquote. A thematic break (`---`, `***`, `___`) and a setext underline (`---`, `===`) also end a paragraph in CommonMark, and neither one is detected. I ran HEAD's `findFileMentions`:

```text
findFileMentions("Intro `x\n---\n@b.md `y")  => []   // CommonMark: <h2>Intro `x</h2><p>@b.md `y</p>
findFileMentions("Intro `x\n===\n@b.md `y")  => []   // same, setext h1
findFileMentions("Intro `x\n***\n@b.md `y")  => []   // CommonMark: <p>..</p><hr><p>@b.md `y</p>
findFileMentions("Intro `x\n___\n@b.md `y")  => []
```

`marked` renders `@b.md` as plain text in all four cases. Upstream attaches it. D-PG11-03 allows a mention to be skipped only when it is really in code, so this is the same parity gap WR-02 reported, and it is just as silent (D-PG11-06 prints only a debug line). Plugin markdown often puts a `---` divider right under a text line. An unmatched backtick above the divider and any backtick below it is then enough to hide an `@file`. The compatibility page (line 74) and the D-PG11-03 record in 11-CONTEXT.md now say "As in CommonMark" and "A code span is one that CommonMark finds". Both overstate what the code does.

**Fix:** Make a thematic-break line and a setext-underline line both start a paragraph and end one. The heading flag already does both. For example:

```ts
// A thematic break, or a setext underline, which ends the paragraph above it.
const BREAK_LINE = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|=+[ \t]*|-+[ \t]*)$/;

function lineShape(line: string): LineShape {
  const content = line.replace(QUOTE_MARKERS, "");
  const quote = line.slice(0, line.length - content.length);
  const block = BLOCK_START.exec(content);
  const breaks = BREAK_LINE.test(content);
  return {
    blank: content.trim() === "",
    quoteDepth: quote.length - quote.replaceAll(">", "").length,
    blockStart: block !== null || breaks,
    heading: block?.[1] !== undefined || breaks,
  };
}
```

Add the four rows above to `test/domain/file-mentions.test.ts`, each expecting `[whole("b.md")]`. Either add the boundary kinds to the compatibility page sentence and the D-PG11-03 record, or drop "As in CommonMark" from both.

## Info

### IN-01: An empty file is attached as an empty block; Pi's own form skips it (carried forward)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:386-407`

**Issue:** D-PG11-05 says the block is "Pi's own form" (`PI/dist/cli/file-processor.js`), and that processor skips an empty file. `renderMentionBlock` returns `<file name="...">\n\n</file>` for zero bytes. Claude Code's Read reports an empty file with a reminder instead.

**Fix:** Return `undefined` for `bytes.length === 0` with a debug cause, or record the choice in D-PG11-06.

### IN-02: A reversed or zero line range attaches an empty block (carried forward)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:51,319-334,396-400`

**Issue:** `@x.md#L5-3` gives `slice(4, 3)`, and `@x.md#L0` gives `slice(0, 0)`. Both are empty, and both attach a block that tells the model the file is empty. I did not verify upstream's `sls` consumer.

**Fix:** Treat `end < start` as one line, or as no range, and clamp `end` to at least `start`. Pin the rule with a test.

### IN-03: Attached file text can split Pi's skill block display (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:174-179,224-228`

**Issue:** Pi's `parseSkillBlock` uses a lazy `\n<\/skill>(?:\n\n([\s\S]+))?$`. So an attached file with a line `</skill>` followed by a blank line ends the parsed block early, and the rest shows as the user's message. The effect is on the display only.

**Fix:** Record the limitation in the compatibility page, or neutralize a bare `</skill>` line in attached content.

### IN-04: Dedup is by mention text, not by resolved file (carried forward)

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:342-355`

**Issue:** `@a.md`, `@./a.md`, and `@${CLAUDE_PROJECT_DIR}/a.md` resolve to one file, and all three are attached.

**Fix:** Dedupe on the resolved absolute path plus the range in `appendMentionedFiles`, or state in D-PG11-04 that dedup is by text.

### IN-05: A command map key with `/` gets a Claude name that splits the key (carried forward)

**File:** `extensions/pi-claude-marketplace/domain/name.ts:546-548`; `extensions/pi-claude-marketplace/bridges/commands/discover.ts:579,610`

**Issue:** `claudeCommandName` splits a D-CF3-03 map key such as `tools/lint` into `plugin:tools:lint`. The plugins reference gives `plugin:tools/lint`.

**Fix:** For `inline` and map-`file` commands, store `${plugin}:${key}`.

### IN-06: "Over-splitting only attaches more mentions" is false; a non-interrupting marker can hide a mention

**File:** `extensions/pi-claude-marketplace/domain/file-mentions.ts:74-78` (comment and `BLOCK_START`), `:240-250`

**Issue:** The code comment says that reading a line as a block start, when it is not one, "only lets more mentions through". The fix record says the same. Both are false. When a group is split, its later part starts pairing its backtick runs again. So a run that CommonMark pairs with an earlier run can instead pair with a later run, and the mask then covers text that CommonMark leaves as plain text. I ran these through HEAD and checked them with `marked`:

```text
findFileMentions("`a\n2. ` @c.md `z`")         => []   // CommonMark: <code>a 2. </code> @c.md <code>z</code>
findFileMentions("Use `a\n    - ` @c.md `z`")  => []   // a 4-space "- " line is paragraph continuation
```

In CommonMark, an ordered marker other than `1` cannot interrupt a paragraph (spec 5.2). Neither can a marker indented 4 or more spaces past a paragraph line. The bridge treats both as block starts. Hard-wrapped prose that puts a numeral at the start of a line is the realistic trigger. This is rare, and the result is the same silent drop as WR-03.

**Fix:** At minimum, correct the comment and the fix record. To match CommonMark more closely, count an ordered marker as a block start only when its number is `1` or the previous line is a list item or blank. Also skip a marker indented 4 or more columns when the previous line is paragraph text. Pin both rows above in the tests.

### IN-07: The WR-01 scenario only proves a negative

**File:** `features/slash-command/aliases.feature:147-167`; `docs/skills-commands-compatibility.md:15,127`

**Issue:** The new scenario checks only that `/demo:demo-ship production` reaches the model as plain text. That would also pass if the session loaded no alias for the plugin, or if the `demo-ship` command did not load at all. The install step checks only that install reported info. The compatibility page says `demo-ship.md` with `name: fancy` "answers to `/demo:ship`, `/demo:fancy`, and `/fancy`" and cites `:147`. No scenario proves those three names for a `demo-ship` file: the Outline at line 13 uses a file named `ship`, so no `<plugin>-` part is removed there.

**Fix:** Turn the scenario into an Outline over the typed name, with an expected-text column. Use the rows `/demo:ship`, `/demo:fancy`, and `/fancy`, each expecting `Ship the branch.\n\nARGUMENTS: production`, and the row `/demo:demo-ship`, expecting the plain text. The negative row then has positive controls on the same fixture.

### IN-08: `commandUpstreamNames` still names a command by its path when its frontmatter sets `name` (pre-existing, unverified upstream)

**File:** `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts:165-170,195-206,272-288`

**Issue:** WR-01 now applies the 2.1.323 rule that a frontmatter `name` replaces a command's path name, but only in the alias reader. The D-CF2-03 helper in the same file still gives the plugin's command names as `<plugin>:<file basename>`, and it never reads the command's frontmatter. That helper decides which skill aliases are suppressed because a command keeps the name. So for `commands/ship.md` with `name: fancy`, it suppresses a skill alias `demo:ship`, which upstream's command no longer holds. It does not suppress `demo:fancy`, which upstream's command does hold. I did not verify how upstream resolves a skill and command conflict on `Zt`, so this rests on judgment. The diff did not introduce it.

**Fix:** Check the upstream conflict rule. If it keys on the command's final name, read each command file's frontmatter `name` in `directoryBasenames`/`declaredBasenames` and give `Ft + name` when `declaresFrontmatterName` is true. Otherwise, record in D-CF2-03 that the suppression uses the path name.

---

_Reviewed: 2026-11-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
